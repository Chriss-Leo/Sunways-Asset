package wallet

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

var (
	// ErrInvalidAddress indicates an address that is not valid Ethereum hex.
	ErrInvalidAddress = errors.New("invalid wallet address")
	// ErrInvalidNonce indicates a missing, reused, or expired sign-in nonce.
	ErrInvalidNonce = errors.New("invalid or expired nonce")
	// ErrInvalidSig indicates a signature that cannot be recovered to the requested wallet.
	ErrInvalidSig = errors.New("invalid wallet signature")
)

// Nonce is the one-time challenge a wallet signs to start an authenticated session.
type Nonce struct {
	Address   string
	Value     string
	Message   string
	ExpiresAt time.Time
	Used      bool
}

// Service manages wallet login nonces in memory.
type Service struct {
	mu     sync.Mutex
	ttl    time.Duration
	nonces map[string]Nonce
	now    func() time.Time
}

// NewService constructs an in-memory wallet nonce service with the configured TTL.
func NewService(ttl time.Duration) *Service {
	return &Service{
		ttl:    ttl,
		nonces: make(map[string]Nonce),
		now:    time.Now,
	}
}

// CreateNonce normalizes an address and creates the exact message that must be signed.
func (s *Service) CreateNonce(address string) (Nonce, error) {
	normalized, err := normalizeAddress(address)
	if err != nil {
		return Nonce{}, err
	}

	value, err := randomHex(16)
	if err != nil {
		return Nonce{}, err
	}

	expiresAt := s.now().Add(s.ttl)
	nonce := Nonce{
		Address:   normalized,
		Value:     value,
		Message:   buildLoginMessage(normalized, value, expiresAt),
		ExpiresAt: expiresAt,
	}

	s.mu.Lock()
	s.nonces[normalized] = nonce
	s.mu.Unlock()

	return nonce, nil
}

// Verify consumes the active nonce for an address and validates its Ethereum personal signature.
func (s *Service) Verify(address string, signature string) error {
	normalized, err := normalizeAddress(address)
	if err != nil {
		return err
	}

	s.mu.Lock()
	nonce, ok := s.nonces[normalized]
	if !ok || nonce.Used || s.now().After(nonce.ExpiresAt) {
		s.mu.Unlock()
		return ErrInvalidNonce
	}
	nonce.Used = true
	s.nonces[normalized] = nonce
	s.mu.Unlock()

	recovered, err := recoverAddress(nonce.Message, signature)
	if err != nil {
		return err
	}
	if !strings.EqualFold(recovered, normalized) {
		return ErrInvalidSig
	}

	return nil
}

// buildLoginMessage creates a human-readable challenge shown by the wallet signing prompt.
func buildLoginMessage(address string, nonce string, expiresAt time.Time) string {
	return fmt.Sprintf(
		"Sunways Asset wants you to sign in with your Ethereum account:\n%s\n\nNonce: %s\nExpires At: %s",
		address,
		nonce,
		expiresAt.UTC().Format(time.RFC3339),
	)
}

// normalizeAddress validates and checksum-normalizes an Ethereum address.
func normalizeAddress(address string) (string, error) {
	if !common.IsHexAddress(address) {
		return "", ErrInvalidAddress
	}
	return common.HexToAddress(address).Hex(), nil
}

// randomHex returns cryptographically secure random bytes encoded as lowercase hex.
func randomHex(size int) (string, error) {
	bytes := make([]byte, size)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// recoverAddress verifies Ethereum Signed Message semantics and returns the signing address.
func recoverAddress(message string, signature string) (string, error) {
	raw := common.FromHex(signature)
	if len(raw) != 65 {
		return "", ErrInvalidSig
	}
	if raw[64] >= 27 {
		raw[64] -= 27
	}
	if raw[64] != 0 && raw[64] != 1 {
		return "", ErrInvalidSig
	}

	// Match wallet_sign / personal_sign prefixing so the recovered address equals the UI signer.
	hash := crypto.Keccak256Hash([]byte(fmt.Sprintf("\x19Ethereum Signed Message:\n%d%s", len(message), message)))
	pubKey, err := crypto.SigToPub(hash.Bytes(), raw)
	if err != nil {
		return "", ErrInvalidSig
	}

	return crypto.PubkeyToAddress(*pubKey).Hex(), nil
}
