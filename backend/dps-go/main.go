package main

import (
	"crypto"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"log"
	"os"

	"github.com/amaneshi/dstucrypt/pkg/core"
)

// DPS API Client for Ukrainian Tax Service
// Uses dstucrypt library for Ukrainian cryptographic standards (DSTU 4145-2002)

type DPSClient struct {
	jksPath     string
	jksPassword string
	privateKey  crypto.Signer
	cert        []byte
}

func NewDPSClient(jksPath, jksPassword string) (*DPSClient, error) {
	client := &DPSClient{
		jksPath:     jksPath,
		jksPassword: jksPassword,
	}

	// Load JKS file
	if err := client.loadJKS(); err != nil {
		return nil, fmt.Errorf("failed to load JKS: %w", err)
	}

	return client, nil
}

func (c *DPSClient) loadJKS() error {
	// Load JKS file using dstucrypt
	keyStore, err := core.LoadJKS(c.jksPath, c.jksPassword)
	if err != nil {
		return fmt.Errorf("failed to load JKS: %w", err)
	}

	// Get first private key and certificate
	if len(keyStore.PrivateKeys) == 0 {
		return fmt.Errorf("no private keys found in JKS")
	}

	c.privateKey = keyStore.PrivateKeys[0]
	c.cert = keyStore.Certificates[0]

	log.Printf("Loaded JKS successfully. Certificate subject: %s", keyStore.Certificates[0].Subject)

	return nil
}

// SignData signs data using DSTU 4145-2002
func (c *DPSClient) SignData(data []byte) ([]byte, error) {
	// Calculate hash using GOST 34.311-95
	hash := core.GOST34311Hash(data)

	// Sign using DSTU 4145-2002
	signature, err := c.privateKey.Sign(nil, hash, crypto.Hash(0))
	if err != nil {
		return nil, fmt.Errorf("failed to sign data: %w", err)
	}

	return signature, nil
}

// CreateUASign1 creates UA_SIGN1 transport container (tax office format)
func (c *DPSClient) CreateUASign1(data []byte) ([]byte, error) {
	// Sign the data
	signature, err := c.SignData(data)
	if err != nil {
		return nil, err
	}

	// Create CMS/PKCS#7 SignedData with certificate
	signedData, err := core.CreateSignedData(data, signature, c.cert, c.privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create signed data: %w", err)
	}

	// Wrap in UA_SIGN1 transport format
	uaSign1, err := core.WrapUASign1(signedData)
	if err != nil {
		return nil, fmt.Errorf("failed to wrap UA_SIGN1: %w", err)
	}

	return uaSign1, nil
}

// SendReport sends report to DPS API
func (c *DPSClient) SendReport(xmlData []byte, fname string) error {
	// Create UA_SIGN1 container
	uaSign1, err := c.CreateUASign1(xmlData)
	if err != nil {
		return err
	}

	// Base64 encode
	contentBase64 := base64.StdEncoding.EncodeToString(uaSign1)

	// Prepare request
	request := map[string]interface{}{
		"fname":         fname,
		"contentBase64": contentBase64,
	}

	log.Printf("Sending report to DPS API. Filename: %s, Base64 length: %d", fname, len(contentBase64))
	log.Printf("Request: %+v", request)

	// TODO: Implement HTTP request to https://cabinet.tax.gov.ua/cabinet/public/api/exchange/report

	return nil
}

func main() {
	// Test with existing JKS file
	jksPath := "/Users/mac/.gemini/antigravity-ide/scratch/unitas/backend/uapki/test_key.jks"
	jksPassword := "Mn290876"

	client, err := NewDPSClient(jksPath, jksPassword)
	if err != nil {
		log.Fatalf("Failed to create DPS client: %v", err)
	}

	// Test signing
	testData := []byte("2800003498")
	signature, err := client.SignData(testData)
	if err != nil {
		log.Fatalf("Failed to sign data: %v", err)
	}

	log.Printf("Signature created successfully. Length: %d bytes", len(signature))
	log.Printf("Signature (Base64): %s", base64.StdEncoding.EncodeToString(signature))

	// Test UA_SIGN1 creation
	uaSign1, err := client.CreateUASign1(testData)
	if err != nil {
		log.Fatalf("Failed to create UA_SIGN1: %v", err)
	}

	log.Printf("UA_SIGN1 created successfully. Length: %d bytes", len(uaSign1))
	log.Printf("UA_SIGN1 (Base64): %s", base64.StdEncoding.EncodeToString(uaSign1))

	// Save UA_SIGN1 to file for analysis
	if err := os.WriteFile("/tmp/ua_sign1.bin", uaSign1, 0644); err != nil {
		log.Fatalf("Failed to save UA_SIGN1: %v", err)
	}

	log.Println("UA_SIGN1 saved to /tmp/ua_sign1.bin")
}
