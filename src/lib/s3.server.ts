// Server-only S3-compatible client (AWS SigV4 via Web Crypto).
// Never import from client code.

export type S3Endpoint = {
  key: string;
  label: string;
  provider: string;
  endpoint_url: string;
  region: string;
  path_style: boolean;
  signature_version: string;
  secret_prefix: string;
  default_bucket: string | null;
  is_active: boolean;
};

export type S3Credentials = { accessKey: string; secretKey: string };

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(data: string | ArrayBuffer): Promise<string> {
  const bytes = typeof data === "string" ? enc.encode(data) : new Uint8Array(data);
  return hex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((seg) => encodeRfc3986(seg))
    .join("/");
}

function amzDate(now: Date) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz: iso, date: iso.slice(0, 8) };
}

export function readCredentials(secretPrefix: string): S3Credentials {
  const accessKey = process.env[`${secretPrefix}_ACCESS_KEY`];
  const secretKey = process.env[`${secretPrefix}_SECRET_KEY`];
  if (!accessKey || !secretKey) {
    throw new Error(`Missing credentials for ${secretPrefix}. Add ${secretPrefix}_ACCESS_KEY and ${secretPrefix}_SECRET_KEY.`);
  }
  return { accessKey, secretKey };
}

function buildUrl(ep: S3Endpoint, bucket: string | null, key: string | null): URL {
  const base = new URL(ep.endpoint_url);
  if (!bucket) return new URL(base.origin + "/");
  if (ep.path_style) {
    return new URL(`${base.origin}/${bucket}${key ? `/${encodePath(key)}` : "/"}`);
  }
  return new URL(`${base.protocol}//${bucket}.${base.host}${key ? `/${encodePath(key)}` : "/"}`);
}

async function signingKey(secret: string, date: string, region: string, service = "s3") {
  const kDate = await hmac(enc.encode(`AWS4${secret}`), date);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

/** Signed request (Authorization header). */
export async function s3Request(
  ep: S3Endpoint,
  creds: S3Credentials,
  opts: {
    method: string;
    bucket?: string | null;
    key?: string | null;
    query?: Record<string, string>;
    body?: ArrayBuffer | undefined;
    contentType?: string | undefined;
  },
): Promise<Response> {
  const url = buildUrl(ep, opts.bucket ?? null, opts.key ?? null);
  const query = opts.query ?? {};
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(query[k] ?? "")}`)
    .join("&");
  if (canonicalQuery) url.search = canonicalQuery;

  const { amz, date } = amzDate(new Date());
  const payloadHash = await sha256Hex(opts.body ?? "");
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amz,
  };
  if (opts.contentType) headers["content-type"] = opts.contentType;

  const signedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaders.map((h) => `${h}:${headers[h]}\n`).join("");
  const signedHeaderList = signedHeaders.join(";");

  const canonicalRequest = [
    opts.method,
    url.pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaderList,
    payloadHash,
  ].join("\n");

  const scope = `${date}/${ep.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = hex(await hmac(await signingKey(creds.secretKey, date, ep.region), stringToSign));

  const init: RequestInit = {
    method: opts.method,
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${creds.accessKey}/${scope}, SignedHeaders=${signedHeaderList}, Signature=${signature}`,
    },
  };
  if (opts.body) init.body = opts.body;

  return fetch(url.toString(), init);
}

/** Pre-signed URL (query auth) for direct browser GET/PUT. */
export async function s3PresignUrl(
  ep: S3Endpoint,
  creds: S3Credentials,
  opts: { method: "GET" | "PUT"; bucket: string; key: string; expiresIn?: number },
): Promise<string> {
  const url = buildUrl(ep, opts.bucket, opts.key);
  const { amz, date } = amzDate(new Date());
  const scope = `${date}/${ep.region}/s3/aws4_request`;
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${creds.accessKey}/${scope}`,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(opts.expiresIn ?? 900),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(query[k] ?? "")}`)
    .join("&");

  const canonicalRequest = [
    opts.method,
    url.pathname,
    canonicalQuery,
    `host:${url.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = hex(await hmac(await signingKey(creds.secretKey, date, ep.region), stringToSign));
  return `${url.origin}${url.pathname}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function tagValues(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(decodeXml(m[1] ?? ""));
  return out;
}

function decodeXml(v: string): string {
  return v
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1] ?? "");
  return out;
}

function first(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return m ? decodeXml(m[1] ?? "") : null;
}

export async function assertOk(res: Response, action: string) {
  if (res.ok) return;
  const body = await res.text();
  const code = first(body, "Code") ?? String(res.status);
  const message = first(body, "Message") ?? body.slice(0, 300);
  throw new Error(`${action} failed [${res.status} ${code}]: ${message}`);
}

export async function listBuckets(ep: S3Endpoint, creds: S3Credentials) {
  const res = await s3Request(ep, creds, { method: "GET" });
  await assertOk(res, "ListBuckets");
  const xml = await res.text();
  return blocks(xml, "Bucket").map((b) => ({
    name: first(b, "Name") ?? "",
    creationDate: first(b, "CreationDate"),
  }));
}

export async function listObjects(
  ep: S3Endpoint,
  creds: S3Credentials,
  bucket: string,
  prefix: string,
  continuationToken?: string | undefined,
) {
  const query: Record<string, string> = {
    "list-type": "2",
    delimiter: "/",
    "max-keys": "200",
  };
  if (prefix) query["prefix"] = prefix;
  if (continuationToken) query["continuation-token"] = continuationToken;

  const res = await s3Request(ep, creds, { method: "GET", bucket, key: null, query });
  await assertOk(res, "ListObjects");
  const xml = await res.text();

  const folders = blocks(xml, "CommonPrefixes")
    .map((b) => first(b, "Prefix") ?? "")
    .filter(Boolean);
  const objects = blocks(xml, "Contents")
    .map((b) => ({
      key: first(b, "Key") ?? "",
      size: Number(first(b, "Size") ?? 0),
      lastModified: first(b, "LastModified"),
      etag: (first(b, "ETag") ?? "").replace(/"/g, ""),
    }))
    .filter((o) => o.key !== prefix);

  return {
    folders,
    objects,
    isTruncated: (tagValues(xml, "IsTruncated")[0] ?? "false") === "true",
    nextToken: first(xml, "NextContinuationToken"),
  };
}

export async function deleteObject(
  ep: S3Endpoint,
  creds: S3Credentials,
  bucket: string,
  key: string,
) {
  const res = await s3Request(ep, creds, { method: "DELETE", bucket, key });
  await assertOk(res, "DeleteObject");
}
