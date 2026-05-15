package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"sunways-asset/backend/internal/auth"
	"sunways-asset/backend/internal/repository"
	"sunways-asset/backend/internal/wallet"

	"gorm.io/gorm"
)

// Server wires HTTP routes to wallet nonce and auth-session services.
type Server struct {
	auth           *auth.Service
	frontendOrigin string
	store          *repository.Store
	wallet         *wallet.Service
}

// NewServer constructs the API server with the allowed frontend origin for CORS.
func NewServer(
	walletSvc *wallet.Service,
	authSvc *auth.Service,
	store *repository.Store,
	frontendOrigin string,
) *Server {
	return &Server{
		auth:           authSvc,
		frontendOrigin: frontendOrigin,
		store:          store,
		wallet:         walletSvc,
	}
}

// Handler returns the full HTTP handler tree, including route registration and CORS.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("POST /auth/nonce", s.createNonce)
	mux.HandleFunc("POST /auth/verify", s.verify)
	mux.HandleFunc("GET /auth/me", s.me)
	mux.HandleFunc("POST /auth/logout", s.logout)
	mux.HandleFunc("GET /stations", s.listStations)
	mux.HandleFunc("GET /stations/{id}", s.getStation)
	mux.HandleFunc("GET /dashboard/summary", s.dashboardSummary)

	return s.withCORS(mux)
}

// health reports process readiness for local checks and container probes.
func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// createNonce issues a one-time wallet-signature challenge for a supplied address.
func (s *Server) createNonce(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Address string `json:"address"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	nonce, err := s.wallet.CreateNonce(req.Address)
	if err != nil {
		writeError(w, statusForError(err), err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"address":   nonce.Address,
		"message":   nonce.Message,
		"nonce":     nonce.Value,
		"expiresAt": nonce.ExpiresAt.Format(time.RFC3339),
	})
}

// verify validates the wallet signature and exchanges it for an API bearer session.
func (s *Server) verify(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Address   string `json:"address"`
		Signature string `json:"signature"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := s.wallet.Verify(req.Address, req.Signature); err != nil {
		writeError(w, statusForError(err), err.Error())
		return
	}

	session, err := s.auth.Create(req.Address)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"token":     session.Token,
		"address":   session.Address,
		"expiresAt": session.ExpiresAt.Format(time.RFC3339),
	})
}

// me returns the active authenticated wallet session.
func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	session, ok := s.sessionFromRequest(w, r)
	if !ok {
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"address":   session.Address,
		"expiresAt": session.ExpiresAt.Format(time.RFC3339),
	})
}

// logout invalidates a bearer session if the caller provided one.
func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	token, ok := bearerToken(r)
	if ok {
		s.auth.Delete(token)
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) listStations(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid limit")
			return
		}
		limit = parsed
	}
	stations, err := s.store.ListStations(limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list stations")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": stations})
}

func (s *Server) getStation(w http.ResponseWriter, r *http.Request) {
	stationID, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid station id")
		return
	}
	station, err := s.store.GetStation(stationID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "station not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to get station")
		return
	}
	writeJSON(w, http.StatusOK, station)
}

func (s *Server) dashboardSummary(w http.ResponseWriter, _ *http.Request) {
	summary, err := s.store.DashboardSummary()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load dashboard summary")
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

// sessionFromRequest extracts and validates a bearer session, writing an HTTP error on failure.
func (s *Server) sessionFromRequest(w http.ResponseWriter, r *http.Request) (auth.Session, bool) {
	token, ok := bearerToken(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing bearer token")
		return auth.Session{}, false
	}

	session, err := s.auth.Get(token)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return auth.Session{}, false
	}

	return session, true
}

// bearerToken parses the Authorization header value expected by the frontend service.
func bearerToken(r *http.Request) (string, bool) {
	value := r.Header.Get("Authorization")
	token, ok := strings.CutPrefix(value, "Bearer ")
	return token, ok && token != ""
}

// withCORS allows the configured frontend to call the local API with JSON and bearer tokens.
func (s *Server) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == s.frontendOrigin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// statusForError maps domain errors into the public HTTP status codes used by the UI.
func statusForError(err error) int {
	switch {
	case errors.Is(err, wallet.ErrInvalidAddress):
		return http.StatusBadRequest
	case errors.Is(err, wallet.ErrInvalidNonce):
		return http.StatusUnauthorized
	case errors.Is(err, wallet.ErrInvalidSig):
		return http.StatusUnauthorized
	default:
		return http.StatusInternalServerError
	}
}

// writeJSON writes a JSON response with the given HTTP status code.
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

// writeError writes the standard API error envelope.
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
