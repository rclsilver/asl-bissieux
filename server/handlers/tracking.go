package handlers

import (
	"bytes"
	"image"
	"image/png"
)

// Encode once; every request receives the same transparent 1x1 PNG, including
// unknown identifiers and database failures. No email content is rendered.
var trackingPixel = func() []byte {
	var out bytes.Buffer
	if err := png.Encode(&out, image.NewNRGBA(image.Rect(0, 0, 1, 1))); err != nil {
		panic(err)
	}
	return out.Bytes()
}()
