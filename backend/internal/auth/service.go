package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"
)

// ErrInvalidSession is returned when a bearer token is unknown or expired.
var ErrInvalidSession = errors.New("invalid or expired session")

// Session is the in-memory bearer session returned after wallet-signature verification.
type Session struct {
	Token     string
	Address   string
	ExpiresAt time.Time
}

// Service owns short-lived authenticated sessions for the API process.
type Service struct {
	mu       sync.Mutex
	ttl      time.Duration
	sessions map[string]Session
	now      func() time.Time
}

// NewService constructs an in-memory auth service with the configured session TTL.
func NewService(ttl time.Duration) *Service {
	return &Service{
		ttl:      ttl,
		sessions: make(map[string]Session),
		now:      time.Now,
	}
}

// Create stores a new bearer session for a wallet address.
func (s *Service) Create(address string) (Session, error) {
	token, err := randomToken(32)
	if err != nil {
		return Session{}, err
	}

	session := Session{
		Token:     token,
		Address:   address,
		ExpiresAt: s.now().Add(s.ttl),
	}

	s.mu.Lock()
	s.sessions[token] = session
	s.mu.Unlock()

	return session, nil
}

// Get returns a valid session for a bearer token or removes access when it is expired.
func (s *Service) Get(token string) (Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	session, ok := s.sessions[token]
	if !ok || s.now().After(session.ExpiresAt) {
		return Session{}, ErrInvalidSession
	}

	return session, nil
}

// Delete removes a bearer token from the in-memory session store.
func (s *Service) Delete(token string) {
	s.mu.Lock()
	delete(s.sessions, token)
	s.mu.Unlock()
}

// randomToken returns cryptographically secure random bytes encoded for HTTP transport.
func randomToken(size int) (string, error) {
	bytes := make([]byte, size)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
