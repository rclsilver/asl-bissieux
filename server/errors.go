package server

type APIError struct {
	Message string `json:"message" description:"The error message returned to the client." example:"internal server error"`
}
