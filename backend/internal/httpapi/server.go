package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"sunways-asset/backend/internal/auth"
	"sunways-asset/backend/internal/repository"
	"sunways-asset/backend/internal/wallet"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Server wires Gin routes to wallet nonce, auth-session, and repository services.
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

// Router returns the Gin engine with routes, middleware, and handlers registered.
func (s *Server) Router() *gin.Engine {
	router := gin.New()
	_ = router.SetTrustedProxies(nil)
	router.Use(gin.Logger(), gin.Recovery(), s.cors())

	router.GET("/health", s.health)
	router.POST("/auth/nonce", s.createNonce)
	router.POST("/auth/verify", s.verify)
	router.GET("/auth/me", s.me)
	router.POST("/auth/logout", s.logout)
	router.GET("/stations", s.listStations)
	router.GET("/stations/:id", s.getStation)
	router.GET("/dashboard/summary", s.dashboardSummary)

	return router
}

func (s *Server) health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (s *Server) createNonce(c *gin.Context) {
	var req struct {
		Address string `json:"address"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	nonce, err := s.wallet.CreateNonce(req.Address)
	if err != nil {
		writeError(c, statusForError(err), err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"address":   nonce.Address,
		"message":   nonce.Message,
		"nonce":     nonce.Value,
		"expiresAt": nonce.ExpiresAt.Format(time.RFC3339),
	})
}

func (s *Server) verify(c *gin.Context) {
	var req struct {
		Address   string `json:"address"`
		Signature string `json:"signature"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := s.wallet.Verify(req.Address, req.Signature); err != nil {
		writeError(c, statusForError(err), err.Error())
		return
	}

	session, err := s.auth.Create(req.Address)
	if err != nil {
		writeError(c, http.StatusInternalServerError, "failed to create session")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":     session.Token,
		"address":   session.Address,
		"expiresAt": session.ExpiresAt.Format(time.RFC3339),
	})
}

func (s *Server) me(c *gin.Context) {
	session, ok := s.sessionFromRequest(c)
	if !ok {
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"address":   session.Address,
		"expiresAt": session.ExpiresAt.Format(time.RFC3339),
	})
}

func (s *Server) logout(c *gin.Context) {
	token, ok := bearerToken(c)
	if ok {
		s.auth.Delete(token)
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (s *Server) listStations(c *gin.Context) {
	limit := 50
	if raw := c.Query("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			writeError(c, http.StatusBadRequest, "invalid limit")
			return
		}
		limit = parsed
	}
	stations, err := s.store.ListStations(limit)
	if err != nil {
		writeError(c, http.StatusInternalServerError, "failed to list stations")
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": stations})
}

func (s *Server) getStation(c *gin.Context) {
	stationID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		writeError(c, http.StatusBadRequest, "invalid station id")
		return
	}
	station, err := s.store.GetStation(stationID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(c, http.StatusNotFound, "station not found")
			return
		}
		writeError(c, http.StatusInternalServerError, "failed to get station")
		return
	}
	c.JSON(http.StatusOK, station)
}

func (s *Server) dashboardSummary(c *gin.Context) {
	summary, err := s.store.DashboardSummary()
	if err != nil {
		writeError(c, http.StatusInternalServerError, "failed to load dashboard summary")
		return
	}
	c.JSON(http.StatusOK, summary)
}

func (s *Server) sessionFromRequest(c *gin.Context) (auth.Session, bool) {
	token, ok := bearerToken(c)
	if !ok {
		writeError(c, http.StatusUnauthorized, "missing bearer token")
		return auth.Session{}, false
	}

	session, err := s.auth.Get(token)
	if err != nil {
		writeError(c, http.StatusUnauthorized, err.Error())
		return auth.Session{}, false
	}

	return session, true
}

func bearerToken(c *gin.Context) (string, bool) {
	value := c.GetHeader("Authorization")
	token, ok := strings.CutPrefix(value, "Bearer ")
	return token, ok && token != ""
}

func (s *Server) cors() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == s.frontendOrigin {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
			c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
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

func writeError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": message})
}
