import { readFile } from "node:fs/promises";

export async function fetchSourceContent(
  type: "URL" | "FILE" | "MANUAL",
  location: string,
): Promise<string> {
  switch (type) {
    case "MANUAL":
      return location;
    case "FILE":
      return readFile(location, "utf8");
    case "URL":
      return fetchUrlText(location);
    default:
      throw new Error(`Unsupported source type: ${type}`);
  }
}

async function fetchUrlText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch URL (${response.status}): ${url}`);
  }
  const html = await response.text();
  return stripHtml(html);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}