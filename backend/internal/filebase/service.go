package filebase

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var ErrDisabled = errors.New("filebase service is not configured")

type UploadResult struct {
	CID        string `json:"cid"`
	IPFSURI    string `json:"ipfsUri"`
	GatewayURL string `json:"gatewayUrl"`
	SizeBytes  int64  `json:"sizeBytes"`
}

type Service struct {
	client     *s3.Client
	bucket     string
	gatewayURL string
	localDir   string
	localURL   string
}

func New(accessKey, secretKey, bucket, gatewayURL string) (*Service, error) {
	if accessKey == "" || secretKey == "" || bucket == "" {
		return nil, ErrDisabled
	}
	if gatewayURL == "" {
		gatewayURL = "https://ipfs.filebase.io/ipfs"
	}

	cfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
		config.WithRegion("us-east-1"),
	)
	if err != nil {
		return nil, fmt.Errorf("filebase: load aws config: %w", err)
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String("https://s3.filebase.com")
		o.UsePathStyle = true
	})

	return &Service{
		client:     client,
		bucket:     bucket,
		gatewayURL: gatewayURL,
	}, nil
}

func NewLocal(localDir, localURL string) (*Service, error) {
	if localDir == "" {
		localDir = "./data/files"
	}
	if err := os.MkdirAll(localDir, 0o755); err != nil {
		return nil, fmt.Errorf("filebase: create local dir: %w", err)
	}
	return &Service{
		localDir: localDir,
		localURL: localURL,
	}, nil
}

func (s *Service) Enabled() bool {
	return s != nil && (s.client != nil || s.localDir != "")
}

func (s *Service) LocalDir() string {
	if s == nil {
		return ""
	}
	return s.localDir
}

func (s *Service) Upload(ctx context.Context, name string, reader io.Reader, size int64) (UploadResult, error) {
	if !s.Enabled() {
		return UploadResult{}, ErrDisabled
	}

	if s.localDir != "" {
		return s.uploadLocal(name, reader, size)
	}

	contentType := mime.TypeByExtension(filepath.Ext(name))
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	input := &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(fmt.Sprintf("%d-%s", time.Now().UnixNano(), name)),
		Body:        io.NopCloser(reader),
		ContentType: aws.String(contentType),
	}

	if _, err := s.client.PutObject(ctx, input); err != nil {
		return UploadResult{}, fmt.Errorf("filebase: upload to s3: %w", err)
	}

	head, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: input.Bucket,
		Key:    input.Key,
	})
	cid := ""
	if err == nil && head != nil {
		cid = head.Metadata["cid"]
	}
	if cid == "" {
		cid = "unknown"
	}

	ipfsURI := fmt.Sprintf("ipfs://%s", cid)
	gatewayURL := fmt.Sprintf("%s/%s", s.gatewayURL, cid)

	return UploadResult{
		CID:        cid,
		IPFSURI:    ipfsURI,
		GatewayURL: gatewayURL,
		SizeBytes:  size,
	}, nil
}

func (s *Service) uploadLocal(name string, reader io.Reader, size int64) (UploadResult, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		return UploadResult{}, fmt.Errorf("filebase: read for local storage: %w", err)
	}

	hash := sha256.Sum256(data)
	cid := hex.EncodeToString(hash[:])

	filename := fmt.Sprintf("%s-%s", cid[:12], name)
	filePath := filepath.Join(s.localDir, filename)
	if err := os.WriteFile(filePath, data, 0o644); err != nil {
		return UploadResult{}, fmt.Errorf("filebase: write local file: %w", err)
	}

	return UploadResult{
		CID:        cid,
		IPFSURI:    fmt.Sprintf("local://%s/%s", cid[:12], name),
		GatewayURL: fmt.Sprintf("%s/%s", s.localURL, filename),
		SizeBytes:  size,
	}, nil
}

func (s *Service) UploadBytes(ctx context.Context, name string, data []byte) (UploadResult, error) {
	return s.Upload(ctx, name, bytes.NewReader(data), int64(len(data)))
}
