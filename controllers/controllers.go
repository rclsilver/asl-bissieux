package controllers

import (
	"github.com/google/uuid"
)

func validateUUID(value string) error {
	if _, err := uuid.Parse(value); err != nil {
		return err
	}
	return nil
}
