package app

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/go-sql-driver/mysql"
	_ "modernc.org/sqlite"
)

// OpenDB uses MySQL when configured; SQLite is only a local development convenience.
func OpenDB() (*sql.DB, error) {
	driver, dsn := "sqlite", "file:data/penny.db?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	if os.Getenv("DB_HOST") != "" {
		driver = "mysql"
		cfg := mysql.NewConfig()
		cfg.User, cfg.Passwd = os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD")
		port := os.Getenv("DB_PORT")
		if port == "" {
			port = "3306"
		}
		cfg.Net, cfg.Addr, cfg.DBName = "tcp", os.Getenv("DB_HOST")+":"+port, os.Getenv("DB_NAME")
		cfg.Timeout, cfg.ReadTimeout, cfg.WriteTimeout = 10*time.Second, 15*time.Second, 15*time.Second
		cfg.Collation = "utf8mb4_unicode_ci"
		if os.Getenv("DB_TLS") != "false" {
			roots, err := x509.SystemCertPool()
			if err != nil {
				roots = x509.NewCertPool()
			}
			if ca := os.Getenv("DB_CA_CERT"); ca != "" {
				if !roots.AppendCertsFromPEM([]byte(ca)) {
					return nil, fmt.Errorf("DB_CA_CERT is not valid PEM")
				}
			}
			if path := os.Getenv("DB_CA_FILE"); path != "" {
				pem, err := os.ReadFile(path)
				if err != nil {
					return nil, err
				}
				if !roots.AppendCertsFromPEM(pem) {
					return nil, fmt.Errorf("DB_CA_FILE is not valid PEM")
				}
			}
			if err := mysql.RegisterTLSConfig("penny", &tls.Config{RootCAs: roots, MinVersion: tls.VersionTLS12, ServerName: os.Getenv("DB_HOST")}); err != nil {
				return nil, err
			}
			cfg.TLSConfig = "penny"
		} else if os.Getenv("APP_ENV") == "production" {
			return nil, fmt.Errorf("production requires verified database TLS")
		}
		dsn = cfg.FormatDSN()
	} else {
		if os.Getenv("APP_ENV") == "production" {
			return nil, fmt.Errorf("DB_HOST must be set in production; local SQLite is not persistent on free hosting")
		}
		if path := os.Getenv("SQLITE_PATH"); path != "" {
			if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
				return nil, err
			}
			dsn = "file:" + filepath.ToSlash(path) + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
		} else if err := os.MkdirAll("data", 0700); err != nil {
			return nil, err
		}
	}
	db, err := sql.Open(driver, dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(3 * time.Minute)
	if driver == "sqlite" {
		db.SetMaxOpenConns(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err = db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("connect database: %w", err)
	}
	if err = migrate(ctx, db, driver); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func migrate(ctx context.Context, db *sql.DB, driver string) error {
	id := "INTEGER PRIMARY KEY AUTOINCREMENT"
	ref := "INTEGER"
	if driver == "mysql" {
		id = "BIGINT PRIMARY KEY AUTO_INCREMENT"
		ref = "BIGINT"
	}
	statements := []string{
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS users (id %s, name VARCHAR(80) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE, password_hash VARCHAR(100) NOT NULL, currency VARCHAR(3) NOT NULL DEFAULT 'INR')`, id),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sessions (token_hash VARCHAR(64) PRIMARY KEY, user_id %s NOT NULL, expires_at BIGINT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`, ref),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS categories (id %s, user_id %s NOT NULL, name VARCHAR(40) NOT NULL, color VARCHAR(7) NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, UNIQUE(user_id,name), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`, id, ref),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS expenses (id %s, user_id %s NOT NULL, category_id %s NOT NULL, title VARCHAR(120) NOT NULL, amount_cents BIGINT NOT NULL, expense_date VARCHAR(10) NOT NULL, notes VARCHAR(500) NOT NULL DEFAULT '', created_at BIGINT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(category_id) REFERENCES categories(id))`, id, ref, ref),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS expense_batches (user_id %s NOT NULL, request_id VARCHAR(64) NOT NULL, payload_hash VARCHAR(64) NOT NULL, expense_ids TEXT NOT NULL, PRIMARY KEY(user_id,request_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`, ref),
	}
	for _, s := range statements {
		if _, err := db.ExecContext(ctx, s); err != nil {
			return fmt.Errorf("initialize schema: %w", err)
		}
	}
	// Check metadata before creating the index (MySQL has no CREATE INDEX IF NOT EXISTS).
	var count int
	query := "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='expenses_user_date'"
	if driver == "mysql" {
		query = "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='expenses' AND index_name='expenses_user_date'"
	}
	if err := db.QueryRowContext(ctx, query).Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		_, err := db.ExecContext(ctx, "CREATE INDEX expenses_user_date ON expenses(user_id,expense_date,id)")
		return err
	}
	return nil
}
