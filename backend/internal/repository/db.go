package repository

import (
	"database/sql"
	"fmt"
	"time"

	"sunways-asset/backend/internal/config"

	_ "github.com/jackc/pgx/v5/stdlib"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func Open(pg config.Postgres) (*gorm.DB, error) {
	rootDSN := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s TimeZone=%s",
		pg.Host,
		pg.Port,
		pg.User,
		pg.Password,
		pg.DBName,
		pg.SSLMode,
		pg.TimeZone,
	)
	rootDB, err := sql.Open("pgx", rootDSN)
	if err != nil {
		return nil, err
	}
	defer rootDB.Close()
	if _, err := rootDB.Exec(`CREATE SCHEMA IF NOT EXISTS ` + pg.Schema); err != nil {
		return nil, err
	}

	db, err := gorm.Open(postgres.Open(pg.DSN()), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxIdleConns(pg.MaxIdleConns)
	sqlDB.SetMaxOpenConns(pg.MaxOpenConns)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	return db, nil
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&IndexedBlock{},
		&IndexerState{},
		&ChainEvent{},
		&Organization{},
		&OrganizationMember{},
		&AssetDraft{},
		&AssetFile{},
		&PlatformAuditLog{},
		&Station{},
		&StationOperationStatus{},
		&RevenueDeposit{},
		&RevenueClaim{},
		&CarbonCreditIssuance{},
		&CarbonCreditRetirement{},
		&GreenCertificateIssuance{},
		&UserAssetSummary{},
	)
}
