package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"sunways-asset/backend/internal/admin"
	"sunways-asset/backend/internal/auth"
	"sunways-asset/backend/internal/repository"
	"sunways-asset/backend/internal/wallet"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Server wires Gin routes to wallet nonce, auth-session, and repository services.
type Server struct {
	admin          *admin.Service
	auth           *auth.Service
	chainID        int64
	frontendOrigin string
	store          *repository.Store
	wallet         *wallet.Service
}

// NewServer constructs the API server with the allowed frontend origin for CORS.
func NewServer(
	walletSvc *wallet.Service,
	authSvc *auth.Service,
	store *repository.Store,
	adminSvc *admin.Service,
	chainID int64,
	frontendOrigin string,
) *Server {
	return &Server{
		admin:          adminSvc,
		auth:           authSvc,
		chainID:        chainID,
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
	router.GET("/stations/operation-statuses", s.listStationOperationStatuses)
	router.GET("/stations/:id", s.getStation)
	router.GET("/revenue/deposits", s.listRevenueDeposits)
	router.GET("/revenue/claims", s.listRevenueClaims)
	router.GET("/carbon/issuances", s.listCarbonIssuances)
	router.GET("/carbon/retirements", s.listCarbonRetirements)
	router.GET("/certificates/issuances", s.listCertificateIssuances)
	router.GET("/accounts/summaries", s.listAccountSummaries)
	router.GET("/indexer/status", s.indexerStatus)
	router.GET("/dashboard/summary", s.dashboardSummary)
	router.POST("/admin/stations", s.adminRegisterStation)
	router.POST("/admin/revenue-deposits", s.adminDepositRevenue)
	router.POST("/admin/carbon-credits", s.adminMintCarbon)
	router.POST("/admin/green-certificates", s.adminIssueCertificate)
	router.PATCH("/admin/stations/:id/review", s.adminReviewStation)
	router.PATCH("/admin/stations/:id/operation-status", s.adminUpdateStationOperationStatus)

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

func (s *Server) listRevenueDeposits(c *gin.Context) {
	items, err := s.store.ListRevenueDeposits(limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list revenue deposits")
}

func (s *Server) listStationOperationStatuses(c *gin.Context) {
	items, err := s.store.ListStationOperationStatuses(limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list station operation statuses")
}

func (s *Server) listRevenueClaims(c *gin.Context) {
	items, err := s.store.ListRevenueClaims(limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list revenue claims")
}

func (s *Server) listCarbonIssuances(c *gin.Context) {
	items, err := s.store.ListCarbonCreditIssuances(limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list carbon issuances")
}

func (s *Server) listCarbonRetirements(c *gin.Context) {
	items, err := s.store.ListCarbonCreditRetirements(limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list carbon retirements")
}

func (s *Server) listCertificateIssuances(c *gin.Context) {
	items, err := s.store.ListGreenCertificateIssuances(limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list certificate issuances")
}

func (s *Server) listAccountSummaries(c *gin.Context) {
	items, err := s.store.ListUserAssetSummaries(limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list account summaries")
}

func (s *Server) indexerStatus(c *gin.Context) {
	state, err := s.store.GetIndexerState(s.chainID, "default")
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, gin.H{
				"chainId":          s.chainID,
				"name":             "default",
				"lastIndexedBlock": 0,
				"latestKnownBlock": 0,
				"lagBlocks":        0,
				"failureCount":     0,
			})
			return
		}
		writeError(c, http.StatusInternalServerError, "failed to load indexer status")
		return
	}

	lag := uint64(0)
	if state.LatestKnownBlock > state.LastIndexedBlock {
		lag = state.LatestKnownBlock - state.LastIndexedBlock
	}
	c.JSON(http.StatusOK, gin.H{
		"chainId":          state.ChainID,
		"name":             state.Name,
		"lastIndexedBlock": state.LastIndexedBlock,
		"lastIndexedHash":  state.LastIndexedHash,
		"latestKnownBlock": state.LatestKnownBlock,
		"lagBlocks":        lag,
		"confirmations":    state.Confirmations,
		"failureCount":     state.FailureCount,
		"lastError":        state.LastError,
		"lastStartedAt":    state.LastStartedAt,
		"lastIndexedAt":    state.LastIndexedAt,
		"updatedAt":        state.UpdatedAt,
	})
}

func (s *Server) adminRegisterStation(c *gin.Context) {
	var req admin.RegisterStationRequest
	if !s.bindAdmin(c, &req) {
		return
	}
	hash, err := s.admin.RegisterStation(c.Request.Context(), req)
	s.writeTx(c, hash, err)
}

func (s *Server) adminDepositRevenue(c *gin.Context) {
	var req admin.DepositRevenueRequest
	if !s.bindAdmin(c, &req) {
		return
	}
	hash, err := s.admin.DepositRevenue(c.Request.Context(), req)
	s.writeTx(c, hash, err)
}

func (s *Server) adminMintCarbon(c *gin.Context) {
	var req admin.MintCarbonRequest
	if !s.bindAdmin(c, &req) {
		return
	}
	hash, err := s.admin.MintCarbon(c.Request.Context(), req)
	s.writeTx(c, hash, err)
}

func (s *Server) adminIssueCertificate(c *gin.Context) {
	var req admin.IssueCertificateRequest
	if !s.bindAdmin(c, &req) {
		return
	}
	hash, err := s.admin.IssueCertificate(c.Request.Context(), req)
	s.writeTx(c, hash, err)
}

func (s *Server) adminReviewStation(c *gin.Context) {
	stationID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		writeError(c, http.StatusBadRequest, "invalid station id")
		return
	}
	var req struct {
		Status string `json:"status"`
		Note   string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Status == "" {
		req.Status = "pending"
	}
	if err := s.store.UpdateStationReview(stationID, req.Status, req.Note); err != nil {
		writeError(c, http.StatusInternalServerError, "failed to update station review")
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (s *Server) adminUpdateStationOperationStatus(c *gin.Context) {
	stationID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		writeError(c, http.StatusBadRequest, "invalid station id")
		return
	}
	var req struct {
		Status      string `json:"status"`
		Utilization string `json:"utilization"`
		Note        string `json:"note"`
		UpdatedBy   string `json:"updatedBy"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Status == "" {
		req.Status = "normal"
	}
	if err := s.store.UpsertStationOperationStatus(repository.StationOperationStatus{
		ChainID:     s.chainID,
		StationID:   stationID,
		Status:      req.Status,
		Utilization: req.Utilization,
		Note:        req.Note,
		UpdatedBy:   req.UpdatedBy,
		UpdatedAt:   time.Now(),
	}); err != nil {
		writeError(c, http.StatusInternalServerError, "failed to update operation status")
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (s *Server) bindAdmin(c *gin.Context, req any) bool {
	if s.admin == nil || !s.admin.Enabled() {
		writeError(c, http.StatusServiceUnavailable, "admin transaction service is not configured")
		return false
	}
	if err := c.ShouldBindJSON(req); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return false
	}
	return true
}

func (s *Server) writeTx(c *gin.Context, hash interface{ Hex() string }, err error) {
	if err != nil {
		if errors.Is(err, admin.ErrDisabled) {
			writeError(c, http.StatusServiceUnavailable, err.Error())
			return
		}
		writeError(c, http.StatusBadRequest, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"txHash": hash.Hex()})
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
			c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func limitFromQuery(c *gin.Context, fallback int) int {
	raw := c.Query("limit")
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return parsed
}

func writeList(c *gin.Context, items any, err error, message string) {
	if err != nil {
		writeError(c, http.StatusInternalServerError, message)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
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
