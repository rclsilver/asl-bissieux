package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/db"
	"github.com/spf13/cobra"
)

func init() {
	var issuer, subject, userID string
	identity := &cobra.Command{Use: "identity", Short: "Manage explicit OIDC identity associations"}
	link := &cobra.Command{Use: "link", Args: cobra.NoArgs,
		Short: "Link a verified issuer/subject to an existing account without changing its rights",
		RunE: func(cmd *cobra.Command, args []string) error {
			if _, err := uuid.Parse(userID); err != nil {
				return fmt.Errorf("invalid account UUID")
			}
			ctx, cancel := context.WithTimeout(cmd.Context(), 15*time.Second)
			defer cancel()
			if err := db.InitDB(); err != nil {
				return err
			}
			if err := auth.LinkIdentity(ctx, issuer, subject, userID); err != nil {
				return err
			}
			fmt.Fprintln(cmd.OutOrStdout(), "Identity linked; account ID and permissions preserved.")
			return nil
		},
	}
	link.Flags().StringVar(&issuer, "issuer", "", "Exact, verified canonical issuer")
	link.Flags().StringVar(&subject, "subject", "", "Verified immutable OIDC subject")
	link.Flags().StringVar(&userID, "user-id", "", "Existing internal account UUID")
	link.MarkFlagRequired("issuer")
	link.MarkFlagRequired("subject")
	link.MarkFlagRequired("user-id")
	identity.AddCommand(link)
	rootCmd.AddCommand(identity)
}
