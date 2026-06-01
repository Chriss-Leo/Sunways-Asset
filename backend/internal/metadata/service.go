package metadata

import (
	"encoding/json"
	"fmt"
	"time"

	"sunways-asset/backend/internal/repository"
)

type Attribute struct {
	TraitType string `json:"trait_type"`
	Value     string `json:"value"`
}

type Document struct {
	Name string `json:"name"`
	URI  string `json:"uri"`
	CID  string `json:"cid,omitempty"`
}

type TokenMetadata struct {
	Name         string      `json:"name"`
	Description  string      `json:"description"`
	Image        string      `json:"image"`
	ExternalURL  string      `json:"external_url"`
	Attributes   []Attribute `json:"attributes"`
	Documents    []Document  `json:"documents,omitempty"`
	AssetType    string      `json:"asset_type"`
	CapacityKW   string      `json:"capacity_kw"`
	Region       string      `json:"region"`
	CommissionedAt string    `json:"commissioned_at,omitempty"`
	CreatedAt    string      `json:"created_at"`
}

func Generate(asset repository.AssetDraft, files []repository.AssetFile) TokenMetadata {
	attrs := []Attribute{
		{TraitType: "Asset Type", Value: asset.AssetType},
		{TraitType: "Country", Value: asset.Country},
		{TraitType: "Region", Value: asset.Region},
	}

	if asset.CapacityKW != "" {
		attrs = append(attrs, Attribute{TraitType: "Capacity (kW)", Value: asset.CapacityKW})
	}
	if asset.ExpectedAnnualKWh != "" {
		attrs = append(attrs, Attribute{TraitType: "Expected Annual (kWh)", Value: asset.ExpectedAnnualKWh})
	}
	if asset.ExpectedRevenue != "" {
		attrs = append(attrs, Attribute{TraitType: "Expected Revenue", Value: asset.ExpectedRevenue})
	}
	if asset.Latitude != "" {
		attrs = append(attrs, Attribute{TraitType: "Latitude", Value: asset.Latitude})
	}
	if asset.Longitude != "" {
		attrs = append(attrs, Attribute{TraitType: "Longitude", Value: asset.Longitude})
	}

	commissionedAt := ""
	if !asset.CreatedAt.IsZero() {
		commissionedAt = asset.CreatedAt.Format(time.RFC3339)
	}

	var image string
	docs := make([]Document, 0, len(files))
	for _, f := range files {
		uri := f.IPFSURI
		if uri == "" && f.GatewayURL != "" {
			uri = f.GatewayURL
		}
		if uri == "" && f.CID != "" {
			uri = fmt.Sprintf("ipfs://%s", f.CID)
		}

		if uri != "" {
			docs = append(docs, Document{
				Name: f.OriginalName,
				URI:  uri,
				CID:  f.CID,
			})
		}

		if image == "" && (f.Category == "asset_image" || f.Category == "asset_photo") {
			image = uri
		}
	}

	description := asset.Description
	if description == "" {
		description = fmt.Sprintf("%s - %s %s", asset.Name, asset.AssetType, asset.Region)
	}

	return TokenMetadata{
		Name:          asset.Name,
		Description:   description,
		Image:         image,
		ExternalURL:   "",
		Attributes:    attrs,
		Documents:     docs,
		AssetType:     asset.AssetType,
		CapacityKW:    asset.CapacityKW,
		Region:        asset.Region,
		CommissionedAt: commissionedAt,
		CreatedAt:     time.Now().UTC().Format(time.RFC3339),
	}
}

func Marshal(meta TokenMetadata) ([]byte, error) {
	return json.MarshalIndent(meta, "", "  ")
}
