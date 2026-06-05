package httpapi

import (
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"sunways-asset/backend/internal/admin"
	"sunways-asset/backend/internal/auth"
	"sunways-asset/backend/internal/filebase"
	"sunways-asset/backend/internal/metadata"
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
	filebase       *filebase.Service
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
	filebaseSvc *filebase.Service,
	chainID int64,
	frontendOrigin string,
) *Server {
	return &Server{
		admin:          adminSvc,
		auth:           authSvc,
		chainID:        chainID,
		filebase:       filebaseSvc,
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
	router.GET("/certificates/retirements", s.listCertificateRetirements)
	router.GET("/accounts/summaries", s.listAccountSummaries)
	router.GET("/fundraising/deposits", s.listFundraisingDeposits)
	router.GET("/fundraising/withdrawals", s.listFundraisingWithdrawals)
	router.GET("/fundraising/dividend-distributions", s.listFundraisingDividendDistributions)
	router.GET("/fundraising/dividend-claims", s.listFundraisingDividendClaims)
	router.GET("/indexer/status", s.indexerStatus)
	router.GET("/dashboard/summary", s.dashboardSummary)
	router.GET("/platform/organizations", s.listOrganizations)
	router.POST("/platform/organizations", s.createOrganization)
	router.GET("/platform/organization-members", s.listOrganizationMembers)
	router.POST("/platform/organization-members", s.createOrganizationMember)
	router.GET("/platform/assets", s.listAssetDrafts)
	router.POST("/platform/assets", s.createAssetDraft)
	router.GET("/platform/assets/:id", s.getAssetDraft)
	router.PATCH("/platform/assets/:id", s.updateAssetDraft)
	router.DELETE("/platform/assets/:id", s.deleteAssetDraft)
	router.PATCH("/platform/assets/:id/status", s.updateAssetDraftStatus)
	router.GET("/platform/files", s.listAssetFiles)
	router.POST("/platform/files", s.createAssetFile)
	router.GET("/platform/audit-logs", s.listPlatformAuditLogs)
	router.POST("/platform/files/upload", s.uploadFileToFilebase)
	router.POST("/platform/assets/:id/metadata", s.generateAssetMetadata)
	router.GET("/platform/assets/:id/issuance-check", s.checkAssetIssuanceReady)
	router.POST("/platform/assets/:id/issue", s.issueAssetDraft)
	router.GET("/files/:name", s.serveLocalFile)
	router.POST("/admin/fundraising/deposit", s.adminFundraisingDeposit)
	router.POST("/admin/fundraising/withdraw", s.adminFundraisingWithdraw)
	router.POST("/admin/fundraising/distribute-dividends", s.adminDistributeDividends)
	router.POST("/admin/revenue-deposits", s.adminDepositRevenue)
	router.POST("/admin/carbon-credits", s.adminMintCarbon)
	router.POST("/admin/carbon-credits/burn", s.adminBurnCarbon)
	router.POST("/admin/green-certificates", s.adminIssueCertificate)
	router.POST("/admin/green-certificates/burn", s.adminBurnCertificate)
	router.PATCH("/admin/stations/:id/review", s.adminReviewStation)
	router.PATCH("/admin/stations/:id/operation-status", s.adminUpdateStationOperationStatus)
	router.PATCH("/admin/stations/:id/chain-status", s.adminUpdateStationChainStatus)

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
	account := c.Query("account")
	var summary repository.DashboardSummary
	var err error
	if account != "" {
		summary, err = s.store.DashboardSummaryByAccount(account)
	} else {
		summary, err = s.store.DashboardSummary()
	}
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

func (s *Server) listCertificateRetirements(c *gin.Context) {
	items, err := s.store.ListGreenCertificateRetirements(limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list certificate retirements")
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

func (s *Server) createOrganization(c *gin.Context) {
	var req repository.Organization
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeError(c, http.StatusBadRequest, "organization name is required")
		return
	}
	org, err := s.store.CreateOrganization(req)
	if err != nil {
		writeError(c, http.StatusBadRequest, err.Error())
		return
	}
	_ = s.store.CreatePlatformAuditLog(repository.PlatformAuditLog{
		OrganizationID: org.ID,
		Actor:          org.WalletAddress,
		Action:         "organization.create",
		ResourceType:   "organization",
		ResourceID:     strconv.FormatUint(uint64(org.ID), 10),
		Result:         "success",
		Summary:        org.Name,
	})
	c.JSON(http.StatusCreated, org)
}

func (s *Server) listOrganizations(c *gin.Context) {
	items, err := s.store.ListOrganizations(limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list organizations")
}

func (s *Server) createOrganizationMember(c *gin.Context) {
	var req repository.OrganizationMember
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.OrganizationID == 0 || strings.TrimSpace(req.WalletAddress) == "" {
		writeError(c, http.StatusBadRequest, "organizationId and walletAddress are required")
		return
	}
	member, err := s.store.CreateOrganizationMember(req)
	if err != nil {
		writeError(c, http.StatusBadRequest, err.Error())
		return
	}
	_ = s.store.CreatePlatformAuditLog(repository.PlatformAuditLog{
		OrganizationID: member.OrganizationID,
		Actor:          member.WalletAddress,
		Action:         "organization.member.create",
		ResourceType:   "organization_member",
		ResourceID:     strconv.FormatUint(uint64(member.ID), 10),
		Result:         "success",
		Summary:        member.Role,
	})
	c.JSON(http.StatusCreated, member)
}

func (s *Server) listOrganizationMembers(c *gin.Context) {
	orgID := uintFromQuery(c, "organizationId")
	items, err := s.store.ListOrganizationMembers(orgID, limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list organization members")
}

func (s *Server) createAssetDraft(c *gin.Context) {
	var req repository.AssetDraft
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeError(c, http.StatusBadRequest, "asset name is required")
		return
	}
	if req.OrganizationID == 0 {
		writeError(c, http.StatusBadRequest, "organizationId is required")
		return
	}
	asset, err := s.store.CreateAssetDraft(req)
	if err != nil {
		writeError(c, http.StatusBadRequest, err.Error())
		return
	}
	_ = s.store.CreatePlatformAuditLog(repository.PlatformAuditLog{
		OrganizationID: asset.OrganizationID,
		Actor:          asset.OwnerWallet,
		Action:         "asset_draft.create",
		ResourceType:   "asset_draft",
		ResourceID:     strconv.FormatUint(uint64(asset.ID), 10),
		Result:         "success",
		Summary:        asset.Name,
	})
	c.JSON(http.StatusCreated, asset)
}

func (s *Server) listAssetDrafts(c *gin.Context) {
	items, err := s.store.ListAssetDrafts(c.Query("status"), limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list asset drafts")
}

func (s *Server) getAssetDraft(c *gin.Context) {
	id, ok := uintParam(c, "id")
	if !ok {
		return
	}
	asset, err := s.store.GetAssetDraft(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(c, http.StatusNotFound, "asset draft not found")
			return
		}
		writeError(c, http.StatusInternalServerError, "failed to get asset draft")
		return
	}
	c.JSON(http.StatusOK, asset)
}

func (s *Server) updateAssetDraft(c *gin.Context) {
	id, ok := uintParam(c, "id")
	if !ok {
		return
	}
	asset, err := s.store.GetAssetDraft(id)
	if err != nil {
		writeError(c, http.StatusNotFound, "asset draft not found")
		return
	}
	if asset.Status == "onchain" {
		writeError(c, http.StatusBadRequest, "cannot edit an on-chain asset")
		return
	}
	var req map[string]any
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return
	}
	editable := map[string]bool{
		"name": true, "assetType": true, "country": true, "region": true,
		"address": true, "latitude": true, "longitude": true,
		"capacityKw": true, "expectedAnnualKwh": true, "expectedRevenue": true,
		"ownerWallet": true, "description": true,
	}
	updates := map[string]any{}
	for k, v := range req {
		if editable[k] {
			updates[k] = v
		}
	}
	if len(updates) == 0 {
		writeError(c, http.StatusBadRequest, "no editable fields provided")
		return
	}
	updated, err := s.store.UpdateAssetDraft(id, updates)
	if err != nil {
		writeError(c, http.StatusInternalServerError, "failed to update asset draft")
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (s *Server) deleteAssetDraft(c *gin.Context) {
	id, ok := uintParam(c, "id")
	if !ok {
		return
	}
	if err := s.store.DeleteAssetDraft(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(c, http.StatusBadRequest, "only drafts in 'draft' or 'rejected' status can be deleted")
			return
		}
		writeError(c, http.StatusInternalServerError, "failed to delete asset draft")
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (s *Server) updateAssetDraftStatus(c *gin.Context) {
	id, ok := uintParam(c, "id")
	if !ok {
		return
	}
	var req struct {
		Status string `json:"status"`
		Note   string `json:"note"`
		Actor  string `json:"actor"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Status == "" {
		writeError(c, http.StatusBadRequest, "status is required")
		return
	}
	asset, err := s.store.UpdateAssetDraftStatus(id, req.Status, req.Note)
	if err != nil {
		if errors.Is(err, gorm.ErrInvalidData) {
			writeError(c, http.StatusBadRequest, "invalid status transition")
			return
		}
		writeError(c, http.StatusBadRequest, err.Error())
		return
	}
	_ = s.store.CreatePlatformAuditLog(repository.PlatformAuditLog{
		OrganizationID: asset.OrganizationID,
		Actor:          req.Actor,
		Action:         "asset_draft.status.update",
		ResourceType:   "asset_draft",
		ResourceID:     strconv.FormatUint(uint64(asset.ID), 10),
		Result:         "success",
		Summary:        req.Status,
	})
	c.JSON(http.StatusOK, asset)
}

func (s *Server) createAssetFile(c *gin.Context) {
	var req repository.AssetFile
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.AssetDraftID == 0 || req.OrganizationID == 0 {
		writeError(c, http.StatusBadRequest, "assetDraftId and organizationId are required")
		return
	}
	if strings.TrimSpace(req.CID) == "" && strings.TrimSpace(req.IPFSURI) == "" {
		writeError(c, http.StatusBadRequest, "cid or ipfsUri is required")
		return
	}
	file, err := s.store.CreateAssetFile(req)
	if err != nil {
		writeError(c, http.StatusBadRequest, err.Error())
		return
	}
	_ = s.store.CreatePlatformAuditLog(repository.PlatformAuditLog{
		OrganizationID: file.OrganizationID,
		Actor:          file.Uploader,
		Action:         "asset_file.create",
		ResourceType:   "asset_file",
		ResourceID:     strconv.FormatUint(uint64(file.ID), 10),
		Result:         "success",
		Summary:        file.OriginalName,
	})
	c.JSON(http.StatusCreated, file)
}

func (s *Server) listAssetFiles(c *gin.Context) {
	assetDraftID := uintFromQuery(c, "assetDraftId")
	items, err := s.store.ListAssetFiles(assetDraftID, limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list asset files")
}

func (s *Server) listPlatformAuditLogs(c *gin.Context) {
	items, err := s.store.ListPlatformAuditLogs(limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list platform audit logs")
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

func (s *Server) adminBurnCarbon(c *gin.Context) {
	var req admin.BurnCarbonRequest
	if !s.bindAdmin(c, &req) {
		return
	}
	hash, err := s.admin.BurnCarbon(c.Request.Context(), req)
	s.writeTx(c, hash, err)
}

func (s *Server) adminUpdateStationChainStatus(c *gin.Context) {
	stationID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		writeError(c, http.StatusBadRequest, "invalid station id")
		return
	}
	var req struct {
		Status uint8 `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, "invalid request body")
		return
	}
	hash, err := s.admin.UpdateStationChainStatus(c.Request.Context(), admin.UpdateStationChainStatusRequest{
		StationID: stationID,
		Status:    req.Status,
	})
	s.writeTx(c, hash, err)
}

func (s *Server) adminBurnCertificate(c *gin.Context) {
	var req admin.BurnCertificateRequest
	if !s.bindAdmin(c, &req) {
		return
	}
	hash, err := s.admin.BurnCertificate(c.Request.Context(), req)
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

func (s *Server) serveLocalFile(c *gin.Context) {
	name := c.Param("name")
	if s.filebase == nil || s.filebase.LocalDir() == "" {
		writeError(c, http.StatusNotFound, "local file serving is not enabled")
		return
	}
	c.File(filepath.Join(s.filebase.LocalDir(), filepath.Base(name)))
}

func (s *Server) uploadFileToFilebase(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		writeError(c, http.StatusBadRequest, "file is required")
		return
	}
	defer file.Close()

	if s.filebase == nil || !s.filebase.Enabled() {
		writeError(c, http.StatusServiceUnavailable, "file storage service is not configured")
		return
	}

	category := c.PostForm("category")
	if category == "" {
		category = "general"
	}
	assetDraftID := uintFromForm(c, "assetDraftId")
	organizationID := uintFromForm(c, "organizationId")
	uploader := c.PostForm("uploader")

	result, err := s.filebase.Upload(c.Request.Context(), header.Filename, file, header.Size)
	if err != nil {
		writeError(c, http.StatusInternalServerError, fmt.Sprintf("upload to filebase failed: %v", err))
		return
	}

	dbFile := repository.AssetFile{
		AssetDraftID:   assetDraftID,
		OrganizationID: organizationID,
		Category:       category,
		OriginalName:   header.Filename,
		MimeType:       header.Header.Get("Content-Type"),
		SizeBytes:      header.Size,
		CID:            result.CID,
		IPFSURI:        result.IPFSURI,
		GatewayURL:     result.GatewayURL,
		Uploader:       uploader,
	}

	record, err := s.store.CreateAssetFile(dbFile)
	if err != nil {
		writeError(c, http.StatusInternalServerError, "failed to save file record")
		return
	}

	_ = s.store.CreatePlatformAuditLog(repository.PlatformAuditLog{
		OrganizationID: organizationID,
		Actor:          uploader,
		Action:         "asset_file.upload",
		ResourceType:   "asset_file",
		ResourceID:     strconv.FormatUint(uint64(record.ID), 10),
		Result:         "success",
		Summary:        fmt.Sprintf("%s (cid: %s)", header.Filename, result.CID),
	})

	c.JSON(http.StatusCreated, gin.H{"file": record, "upload": result})
}

func (s *Server) generateAssetMetadata(c *gin.Context) {
	id, ok := uintParam(c, "id")
	if !ok {
		return
	}

	asset, err := s.store.GetAssetDraft(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(c, http.StatusNotFound, "asset draft not found")
			return
		}
		writeError(c, http.StatusInternalServerError, "failed to get asset draft")
		return
	}

	files, err := s.store.ListAssetFiles(id, 100)
	if err != nil {
		writeError(c, http.StatusInternalServerError, "failed to list asset files")
		return
	}

	meta := metadata.Generate(asset, files)
	metaBytes, err := metadata.Marshal(meta)
	if err != nil {
		writeError(c, http.StatusInternalServerError, "failed to serialize metadata")
		return
	}

	var metadataURI string
	if s.filebase == nil || !s.filebase.Enabled() {
		writeError(c, http.StatusServiceUnavailable, "file storage service is not configured — metadata cannot be stored")
		return
	}
	name := fmt.Sprintf("metadata-%d.json", id)
	result, uploadErr := s.filebase.UploadBytes(c.Request.Context(), name, metaBytes)
	if uploadErr != nil {
		writeError(c, http.StatusInternalServerError, fmt.Sprintf("upload metadata to ipfs failed: %v", uploadErr))
		return
	}
	metadataURI = result.IPFSURI

	_ = s.store.CreatePlatformAuditLog(repository.PlatformAuditLog{
		OrganizationID: asset.OrganizationID,
		Actor:          "system",
		Action:         "asset_metadata.generate",
		ResourceType:   "asset_draft",
		ResourceID:     strconv.FormatUint(uint64(id), 10),
		Result:         "success",
		Summary:        fmt.Sprintf("metadata uploaded to %s", result.IPFSURI),
	})
	asset, err = s.store.UpdateAssetDraftMetadata(id, metadataURI)
	if err != nil {
		writeError(c, http.StatusInternalServerError, "failed to save metadata URI")
		return
	}
	_ = s.store.CreatePlatformAuditLog(repository.PlatformAuditLog{
		OrganizationID: asset.OrganizationID,
		Actor:          "system",
		Action:         "asset_metadata.ready",
		ResourceType:   "asset_draft",
		ResourceID:     strconv.FormatUint(uint64(id), 10),
		Result:         "success",
		Summary:        metadataURI,
	})

	c.JSON(http.StatusOK, gin.H{
		"metadata":    meta,
		"metadataUri": metadataURI,
	})
}

func (s *Server) checkAssetIssuanceReady(c *gin.Context) {
	id, ok := uintParam(c, "id")
	if !ok {
		return
	}

	asset, err := s.store.GetAssetDraft(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(c, http.StatusNotFound, "asset draft not found")
			return
		}
		writeError(c, http.StatusInternalServerError, "failed to get asset draft")
		return
	}

	files, err := s.store.ListAssetFiles(id, 100)
	if err != nil {
		writeError(c, http.StatusInternalServerError, "failed to list asset files")
		return
	}
	checks, allPassed := issuanceChecks(asset, files)

	c.JSON(http.StatusOK, gin.H{
		"ready":       allPassed,
		"assetId":     id,
		"status":      asset.Status,
		"metadataUri": asset.MetadataURI,
		"checks":      checks,
	})
}

func (s *Server) issueAssetDraft(c *gin.Context) {
	id, ok := uintParam(c, "id")
	if !ok {
		return
	}
	if s.admin == nil || !s.admin.Enabled() {
		writeError(c, http.StatusServiceUnavailable, "admin transaction service is not configured")
		return
	}
	var req struct {
		Actor string `json:"actor"`
	}
	_ = c.ShouldBindJSON(&req)

	asset, err := s.store.GetAssetDraft(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(c, http.StatusNotFound, "asset draft not found")
			return
		}
		writeError(c, http.StatusInternalServerError, "failed to get asset draft")
		return
	}
	files, err := s.store.ListAssetFiles(id, 100)
	if err != nil {
		writeError(c, http.StatusInternalServerError, "failed to list asset files")
		return
	}
	checks, ready := issuanceChecks(asset, files)
	if !ready {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "asset is not ready for issuance — some checks have failed",
			"ready":   false,
			"assetId": id,
			"checks":  checks,
		})
		return
	}

	commissionedAt := asset.CreatedAt
	if asset.ApprovedAt != nil {
		commissionedAt = *asset.ApprovedAt
	}
	if commissionedAt.IsZero() {
		commissionedAt = time.Now()
	}
	result, err := s.admin.RegisterStationAndWait(c.Request.Context(), admin.RegisterStationRequest{
		Owner:          asset.OwnerWallet,
		Name:           asset.Name,
		Region:         asset.Region,
		CapacityKW:     asset.CapacityKW,
		CommissionedAt: uint64(commissionedAt.Unix()),
		MetadataURI:    asset.MetadataURI,
	})
	if err != nil {
		writeError(c, http.StatusBadRequest, err.Error())
		return
	}
	issued, err := s.store.MarkAssetDraftIssued(id, result.StationID, result.TxHash.Hex())
	if err != nil {
		writeError(c, http.StatusInternalServerError, "failed to mark asset as issued")
		return
	}
	actor := req.Actor
	if actor == "" {
		actor = asset.OwnerWallet
	}
	_ = s.store.CreatePlatformAuditLog(repository.PlatformAuditLog{
		OrganizationID: asset.OrganizationID,
		Actor:          actor,
		Action:         "asset_draft.issue",
		ResourceType:   "asset_draft",
		ResourceID:     strconv.FormatUint(uint64(id), 10),
		Result:         "success",
		Summary:        fmt.Sprintf("station %d minted in %s", result.StationID, result.TxHash.Hex()),
	})
	c.JSON(http.StatusOK, gin.H{
		"asset":     issued,
		"stationId": result.StationID,
		"txHash":    result.TxHash.Hex(),
	})
}

func issuanceChecks(asset repository.AssetDraft, files []repository.AssetFile) ([]gin.H, bool) {
	checks := make([]gin.H, 0)
	allPassed := true

	statusPassed := asset.Status == "approved" || asset.Status == "metadata_ready"
	statusCheck := gin.H{"check": "status_approved", "passed": statusPassed}
	if !statusPassed {
		statusCheck["message"] = fmt.Sprintf("asset status is '%s', must be 'approved' or 'metadata_ready'", asset.Status)
		allPassed = false
	}
	checks = append(checks, statusCheck)

	metadataCheck := gin.H{"check": "metadata_ready", "passed": asset.MetadataURI != ""}
	if asset.MetadataURI == "" {
		metadataCheck["message"] = "metadata URI is not set"
		allPassed = false
	}
	checks = append(checks, metadataCheck)

	walletCheck := gin.H{"check": "wallet_valid", "passed": strings.HasPrefix(asset.OwnerWallet, "0x") && len(asset.OwnerWallet) == 42}
	if !walletCheck["passed"].(bool) {
		walletCheck["message"] = "owner wallet address is invalid"
		allPassed = false
	}
	checks = append(checks, walletCheck)

	nameCheck := gin.H{"check": "name_set", "passed": strings.TrimSpace(asset.Name) != ""}
	if !nameCheck["passed"].(bool) {
		nameCheck["message"] = "asset name is required"
		allPassed = false
	}
	checks = append(checks, nameCheck)

	fileCheck := gin.H{"check": "has_files", "passed": len(files) > 0}
	if !fileCheck["passed"].(bool) {
		fileCheck["message"] = "no files attached to asset"
		allPassed = false
	}
	checks = append(checks, fileCheck)

	existingStation := asset.StationID != nil
	dupCheck := gin.H{"check": "not_already_minted", "passed": !existingStation}
	if existingStation {
		dupCheck["message"] = fmt.Sprintf("asset already minted as station %d", *asset.StationID)
		allPassed = false
	}
	checks = append(checks, dupCheck)

	return checks, allPassed
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

func (s *Server) listFundraisingDeposits(c *gin.Context) {
	items, err := s.store.ListFundraisingDeposits(limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list fundraising deposits")
}

func (s *Server) listFundraisingWithdrawals(c *gin.Context) {
	items, err := s.store.ListFundraisingWithdrawals(limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list fundraising withdrawals")
}

func (s *Server) listFundraisingDividendDistributions(c *gin.Context) {
	items, err := s.store.ListFundraisingDividendDistributions(limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list fundraising dividend distributions")
}

func (s *Server) listFundraisingDividendClaims(c *gin.Context) {
	items, err := s.store.ListFundraisingDividendClaims(limitFromQuery(c, 100))
	writeList(c, items, err, "failed to list fundraising dividend claims")
}

func (s *Server) adminFundraisingDeposit(c *gin.Context) {
	var req admin.FundraisingDepositRequest
	if !s.bindAdmin(c, &req) {
		return
	}
	hash, err := s.admin.FundraisingDeposit(c.Request.Context(), req)
	s.writeTx(c, hash, err)
}

func (s *Server) adminFundraisingWithdraw(c *gin.Context) {
	var req admin.FundraisingWithdrawRequest
	if !s.bindAdmin(c, &req) {
		return
	}
	hash, err := s.admin.FundraisingWithdraw(c.Request.Context(), req)
	s.writeTx(c, hash, err)
}

func (s *Server) adminDistributeDividends(c *gin.Context) {
	var req admin.DistributeDividendsRequest
	if !s.bindAdmin(c, &req) {
		return
	}
	hash, err := s.admin.DistributeDividends(c.Request.Context(), req)
	s.writeTx(c, hash, err)
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
			c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
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

func uintFromQuery(c *gin.Context, key string) uint {
	raw := c.Query(key)
	if raw == "" {
		return 0
	}
	parsed, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return 0
	}
	return uint(parsed)
}

func uintFromForm(c *gin.Context, key string) uint {
	raw := c.PostForm(key)
	if raw == "" {
		return 0
	}
	parsed, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return 0
	}
	return uint(parsed)
}

func uintParam(c *gin.Context, key string) (uint, bool) {
	parsed, err := strconv.ParseUint(c.Param(key), 10, 64)
	if err != nil {
		writeError(c, http.StatusBadRequest, "invalid id")
		return 0, false
	}
	return uint(parsed), true
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
