package handlers

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juju/errors"
	"github.com/sirupsen/logrus"

	"github.com/rclsilver/asl-bissieux/controllers"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/db"
)

type lisEmailTemplatesIn struct{}

func ListEmailTemplates(c *gin.Context, in *lisEmailTemplatesIn) ([]*models.EmailTemplate, error) {
	db := db.Connection(c)

	result, err := controllers.ListEmailTemplates(db)
	if err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get email templates")
		return nil, err
	}

	return result, nil
}

type getEmailTemplateIn struct {
	TemplateID string `path:"template_id"`
}

func GetEmailTemplate(c *gin.Context, in *getEmailTemplateIn) (*models.EmailTemplate, error) {
	db := db.Connection(c)

	result, err := controllers.GetEmailTemplate(db, in.TemplateID)
	if err != nil {
		if !errors.IsNotFound(err) {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get email template")
		}
		return nil, err
	}

	return result, nil
}

type createEmailTemplateIn struct {
	Label   string `json:"label" binding:"required"`
	Subject string `json:"subject" binding:"required"`
	Message string `json:"message" binding:"required"`
}

const (
	CreateEmailTemplateAction = "email.CreateEmailTemplate"
)

func CreateEmailTemplate(c *gin.Context, in *createEmailTemplateIn) (*models.EmailTemplate, error) {
	db := db.Connection(c)

	row, err := controllers.CreateEmailTemplate(db, in.Label, in.Subject, in.Message)
	if err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to create email template")
		return nil, err
	}

	logrus.WithContext(c.Request.Context()).Infof("email template %s (%s) created", row.Label, row.ID)

	return row, nil
}

type updateEmailTemplateIn struct {
	TemplateID string `path:"template_id"`

	createEmailTemplateIn
}

const (
	UpdateEmailTemplateAction = "email.UpdateEmailTemplate"
)

func UpdateEmailTemplate(c *gin.Context, in *updateEmailTemplateIn) (*models.EmailTemplate, error) {
	db := db.Connection(c)

	row, err := controllers.UpdateEmailTemplate(db, in.TemplateID, in.Label, in.Subject, in.Message)
	if err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to update email template")
		return nil, err
	}

	logrus.WithContext(c.Request.Context()).Infof("email template %s (%s) updated", row.Label, row.ID)

	return row, nil
}

const (
	DeleteEmailTemplateAction = "email.DeleteEmailTemplate"
)

type deleteEmailTemplateIn struct {
	TemplateID string `path:"template_id"`
}

func DeleteEmailTemplate(c *gin.Context, in *deleteEmailTemplateIn) error {
	db := db.Connection(c)

	if err := controllers.DeleteEmailTemplate(db, in.TemplateID); err != nil {
		if !errors.IsNotFound(err) {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to delete email template")
		}
		return err
	}

	return nil
}

type previewEmailTemplateIn struct {
	TemplateID string         `path:"template_id"`
	Data       map[string]any `json:"data" binding:"required"`
}

func PreviewEmailTemplate(c *gin.Context, in *previewEmailTemplateIn) (*models.BuiltEmail, error) {
	db := db.Connection(c)

	preview, err := controllers.PreviewEmailTemplate(db, in.TemplateID, in.Data)
	if err != nil {
		if !errors.IsNotFound(err) {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to delete email template")
		}
		return nil, err
	}

	return preview, nil
}

type listAttachmentsIn struct {
	TemplateID string `path:"template_id"`
}

func ListAttachments(c *gin.Context, in *listAttachmentsIn) ([]*models.Attachment, error) {
	db := db.Connection(c)

	result, err := controllers.ListAttachments(db, in.TemplateID)
	if err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get attachments")
		return nil, err
	}

	return result, nil
}

const (
	AddAttachmentAction = "email.AddAttachment"
)

type addAttachmentIn struct {
	TemplateID string `path:"template_id"`

	Name        string `context:"name" binding:"required"`
	Inline      bool   `context:"inline" binding:"required"`
	Content     []byte `context:"content" binding:"required"`
	ContentType string `context:"content_type" binding:"required"`
}

func AddAttachmentMiddleware(c *gin.Context) {
	file, err := c.FormFile("content")
	if err != nil {
		logrus.WithContext(c).WithError(err).Error("unable to get file form field")
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	name, ok := c.Request.MultipartForm.Value["name"]
	if !ok || len(name) == 0 {
		err := fmt.Errorf("unable to get name form field")
		logrus.WithContext(c).Error(err)
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}

	inlineStr, ok := c.Request.MultipartForm.Value["inline"]
	if !ok || len(inlineStr) == 0 {
		err := fmt.Errorf("unable to get inline form field")
		logrus.WithContext(c).Error(err)
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}
	inline, err := strconv.ParseBool(inlineStr[0])
	if err != nil {
		logrus.WithContext(c).WithError(err).Error("unable to parse inline form field")
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}

	contentType, ok := c.Request.MultipartForm.Value["content_type"]
	if !ok || len(contentType) == 0 {
		err := fmt.Errorf("unable to get contentType form field")
		logrus.WithContext(c).Error(err)
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}

	f, err := file.Open()
	if err != nil {
		logrus.WithContext(c).WithError(err).Error("unable to open the file for reading")
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	var content bytes.Buffer
	if _, err := io.Copy(&content, f); err != nil {
		logrus.WithContext(c).WithError(err).Error("unable to read the file")
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	for k := range c.Request.Form {
		delete(c.Request.Form, k)
	}

	c.Set("name", name[0])
	c.Set("inline", inline)
	c.Set("content_type", contentType[0])
	c.Set("content", content.Bytes())
}

func AddAttachment(c *gin.Context, in *addAttachmentIn) (*models.Attachment, error) {
	db := db.Connection(c)

	result, err := controllers.AddAttachment(db, in.TemplateID, in.Name, in.Inline, in.ContentType, in.Content)
	if err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to add attachment")
		return nil, err
	}

	return result, nil
}

type downloadAttachmentIn struct {
	TemplateID   string `path:"template_id"`
	AttachmentID string `path:"attachment_id"`
}

func DownloadAttachment(c *gin.Context, in *downloadAttachmentIn) error {
	attachment, err := controllers.GetAttachment(db.Connection(c), in.TemplateID, in.AttachmentID)
	if err != nil {
		if !errors.IsNotFound(err) {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get attachment")
		}
		return err
	}

	c.Writer.Header().Set("Content-Type", attachment.ContentType)
	c.Writer.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", attachment.Name))

	c.Writer.Write(attachment.Content)

	return nil
}

const (
	RemoveAttachmentAction = "email.RemoveAttachment"
)

type removeAttachmentIn struct {
	TemplateID   string `path:"template_id"`
	AttachmentID string `path:"attachment_id"`
}

func RemoveAttachment(c *gin.Context, in *removeAttachmentIn) error {
	db := db.Connection(c)

	if err := controllers.DeleteAttachment(db, in.TemplateID, in.AttachmentID); err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to remove attachment")
		return err
	}

	return nil
}

type listEmailsIn struct{}

func ListEmails(c *gin.Context, in *listEmailsIn) ([]*models.Email, error) {
	db := db.Connection(c)

	result, err := controllers.ListEmails(db)
	if err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get emails")
		return nil, err
	}

	return result, nil
}

type getEmailIn struct {
	EmailID string `path:"email_id"`
}

func GetEmail(c *gin.Context, in *getEmailIn) (*models.Email, error) {
	db := db.Connection(c)

	result, err := controllers.GetEmail(db, in.EmailID, false)
	if err != nil {
		if !errors.IsNotFound(err) {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get email")
		}
		return nil, err
	}

	return result, nil
}

const (
	DeleteEmailAction = "email.DeleteEmail"
)

type deleteEmailIn struct {
	EmailID string `path:"email_id"`
}

// DeleteEmail delete an email
func DeleteEmail(c *gin.Context, in *deleteEmailIn) error {
	db := db.Connection(c)

	if err := controllers.DeleteEmail(db, in.EmailID); err != nil {
		if !errors.IsNotFound(err) {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to delete email")
		}
		return err
	}

	return nil
}

const (
	SendEmailAction = "email.SendEmail"
)

type sendEmailIn struct {
	EmailID string `path:"email_id"`
	Wait    bool   `json:"wait"`
}

// SendEmail send an email
func SendEmail(c *gin.Context, in *sendEmailIn) error {
	db := db.Connection(c)

	if err := controllers.SendEmail(c, db, in.EmailID, in.Wait); err != nil {
		if !errors.IsNotFound(err) {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to send email")
		}
		return err
	}

	return nil
}

type trackEmailIn struct {
	EmailID string `path:"email_id"`
}

// SendEmail send an email
func TrackEmail(c *gin.Context, in *trackEmailIn) error {
	db := db.Connection(c)

	email, err := controllers.GetEmail(db, in.EmailID, true)
	if err != nil {
		if !errors.IsNotFound(err) {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get email")
		}
	} else if email.State != models.Read {
		if err := controllers.MarkAsRead(c, db, email.ID); err != nil {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to update email")
		}
	}

	c.Header("Content-Type", "image/png")
	c.Writer.Write([]byte{})

	return nil
}
