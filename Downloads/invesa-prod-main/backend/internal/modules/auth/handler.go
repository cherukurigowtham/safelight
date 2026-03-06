package auth

import (
	"context"
	"net/http"

	"invesa_backend/internal/database"
	"invesa_backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Provision creates or updates a local user record from a Neon Auth identity.
// Called by the frontend on first login and after session refresh.
// The JWT is already validated by RequireAuth middleware — user_id = Neon sub.
func Provision(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		utils.RespondWithError(c, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var input struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Role     string `json:"role"`
		Bio      string `json:"bio"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "Invalid request body")
		return
	}

	id := userID.(string)
	// Validate that id is a UUID (Neon sub is UUID format)
	if _, err := uuid.Parse(id); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "Invalid user ID format")
		return
	}

	username := input.Username
	if username == "" {
		// Derive from email if not provided
		if input.Email != "" {
			for i, ch := range input.Email {
				if ch == '@' {
					username = input.Email[:i]
					break
				}
			}
		}
		if username == "" {
			username = "user_" + id[:8]
		}
	}

	// Normalise role — default to Entrepreneur
	role := input.Role
	if role != "Investor" {
		role = "Entrepreneur"
	}

	// Upsert: insert if not exists (keep existing username/bio on conflict)
	_, err := database.DB.Exec(context.Background(),
		`INSERT INTO users (id, username, email, password_hash, role, bio)
		 VALUES ($1, $2, $3, '', $4, $5)
		 ON CONFLICT (id) DO NOTHING`,
		id, username, input.Email, role, input.Bio,
	)
	if err != nil {
		// Possible username collision — try with a UUID suffix
		username = username + "_" + id[:6]
		_, err = database.DB.Exec(context.Background(),
			`INSERT INTO users (id, username, email, password_hash, role, bio)
			 VALUES ($1, $2, $3, '', $4, $5)
			 ON CONFLICT (id) DO NOTHING`,
			id, username, input.Email, role, input.Bio,
		)
		if err != nil {
			utils.RespondWithError(c, http.StatusInternalServerError, "Failed to provision user: "+err.Error())
			return
		}
	}

	// Fetch the current record to return to client
	var u struct {
		ID       string `db:"id"`
		Username string `db:"username"`
		Email    string `db:"email"`
		Role     string `db:"role"`
		Bio      string `db:"bio"`
	}
	row := database.DB.QueryRow(context.Background(),
		`SELECT id, username, email, role, COALESCE(bio, '') FROM users WHERE id=$1`, id)
	if err := row.Scan(&u.ID, &u.Username, &u.Email, &u.Role, &u.Bio); err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "Failed to fetch provisioned user")
		return
	}

	utils.RespondWithJSON(c, http.StatusOK, gin.H{
		"user": gin.H{
			"id":       u.ID,
			"username": u.Username,
			"email":    u.Email,
			"role":     u.Role,
			"bio":      u.Bio,
		},
	})
}
