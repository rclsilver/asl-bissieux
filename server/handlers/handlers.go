package handlers

import (
	"github.com/google/uuid"
	"github.com/juju/errors"
)

func validateUUID(value, message string) error {
	if _, err := uuid.Parse(value); err != nil {
		return errors.NewBadRequest(err, message)
	}
	return nil
}
