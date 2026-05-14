package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"sunways-asset/backend/internal/auth"
	"sunways-asset/backend/internal/wallet"
)

type Server struct {
	auth           *auth.Service
	frontendOrigin string
	wallet         *wallet.Service
}

func NewServer(walletSvc *wallet.Service, authSvc *auth.Service, frontendOrigin string) *Server {
	return &Server{
		auth:           authSvc,
		frontendOrigin: frontendOrigin,
		wallet:         walletSvc,
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("POST /auth/nonce", s.createNonce)
	mux.HandleFunc("POST /auth/verify", s.verify)
	mux.HandleFunc("GET /auth/me", s.me)
	mux.HandleFunc("POST /auth/logout", s.logout)

	return s.withCORS(mux)
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

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

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	token, ok := bearerToken(r)
	if ok {
		s.auth.Delete(token)
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

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

func bearerToken(r *http.Request) (string, bool) {
	value := r.Header.Get("Authorization")
	token, ok := strings.CutPrefix(value, "Bearer ")
	return token, ok && token != ""
}

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

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
