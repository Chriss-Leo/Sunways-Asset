package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"
)

var ErrInvalidSession = errors.New("invalid or expired session")

type Session struct {
	Token     string
	Address   string
	ExpiresAt time.Time
}

type Service struct {
	mu       sync.Mutex
	ttl      time.Duration
	sessions map[string]Session
	now      func() time.Time
}

func NewService(ttl time.Duration) *Service {
	return &Service{
		ttl:      ttl,
		sessions: make(map[string]Session),
		now:      time.Now,
	}
}

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

func (s *Service) Get(token string) (Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	session, ok := s.sessions[token]
	if !ok || s.now().After(session.ExpiresAt) {
		return Session{}, ErrInvalidSession
	}

	return session, nil
}

func (s *Service) Delete(token string) {
	s.mu.Lock()
	delete(s.sessions, token)
	s.mu.Unlock()
}

func randomToken(size int) (string, error) {
	bytes := make([]byte, size)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
