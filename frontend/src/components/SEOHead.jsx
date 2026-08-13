import { useEffect } from "react";

/**
 * Lightweight dynamic SEO Head manager component.
 * Synchronizes page title, meta description, keywords, canonical URL, and Open Graph tags.
 */
export default function SEOHead({
  title,
  description,
  keywords,
  canonicalUrl,
  ogType = "website",
  ogImage = "https://cyphercorp.com/og-image.svg",
}) {
  useEffect(() => {
    // 1. Update Document Title
    const defaultTitle = "CypherCorp — Next-Gen AI Data Intelligence & AutoML Studio";
    const fullTitle = title ? `${title} | CypherCorp` : defaultTitle;
    document.title = fullTitle;

    // Helper to update or create meta tag by name or property
    const setMetaTag = (attribute, attrValue, content) => {
      if (!content) return;
      let element = document.querySelector(`meta[${attribute}="${attrValue}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, attrValue);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    // Helper for link tags (e.g. canonical)
    const setLinkTag = (rel, href) => {
      if (!href) return;
      let element = document.querySelector(`link[rel="${rel}"]`);
      if (!element) {
        element = document.createElement("link");
        element.setAttribute("rel", rel);
        document.head.appendChild(element);
      }
      element.setAttribute("href", href);
    };

    // 2. Standard Meta Tags
    if (description) {
      setMetaTag("name", "description", description);
    }
    if (keywords) {
      setMetaTag("name", "keywords", keywords);
    }

    // 3. Open Graph Tags
    setMetaTag("property", "og:title", fullTitle);
    if (description) {
      setMetaTag("property", "og:description", description);
    }
    setMetaTag("property", "og:type", ogType);
    if (canonicalUrl) {
      setMetaTag("property", "og:url", canonicalUrl);
      setLinkTag("canonical", canonicalUrl);
    }
    if (ogImage) {
      setMetaTag("property", "og:image", ogImage);
    }

    // 4. Twitter Cards
    setMetaTag("name", "twitter:title", fullTitle);
    if (description) {
      setMetaTag("name", "twitter:description", description);
    }
    if (ogImage) {
      setMetaTag("name", "twitter:image", ogImage);
    }
  }, [title, description, keywords, canonicalUrl, ogType, ogImage]);

  return null;
}
