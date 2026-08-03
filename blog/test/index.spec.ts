import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src/index';
import { renderMarkdown } from '../src/utils/markdown';
import { hashPassword } from '../src/utils/auth';
import { schemaStatements } from './schema';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

// 直接调用 worker.fetch，可控 Request（header / body）
async function fetchWorker(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	const url =
		typeof input === 'string' && input.startsWith('/')
			? 'https://blog.test' + input
			: input;
	const request = new IncomingRequest(url, init);
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

// 每个测试文件独立 miniflare 实例，DB 为空；beforeAll 初始化 schema 并插入测试用户
beforeAll(async () => {
	// 逐条执行 schema 语句初始化表结构（D1 exec 不支持一次多条）
	for (const stmt of schemaStatements) {
		await env.DB.prepare(stmt).run();
	}
	const passwordHash = await hashPassword('Password123');
	await env.DB.prepare(
		`INSERT INTO users (username, email, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?)`
	)
		.bind('testuser', 'test@example.com', passwordHash, '测试用户', 'admin')
		.run();
});

describe('health & basics', () => {
	it('GET /health returns ok', async () => {
		const res = await fetchWorker('/health');
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.status).toBe('ok');
	});

	it('GET / serves the homepage HTML', async () => {
		const res = await fetchWorker('/');
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toContain('<html');
	});

	it('GET /api/posts returns an empty list with pagination', async () => {
		const res = await fetchWorker('/api/posts');
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.success).toBe(true);
		expect(Array.isArray(data.data)).toBe(true);
		expect(data.pagination.total).toBe(0);
	});
});

describe('security headers & CORS', () => {
	it('applies security headers on every response', async () => {
		const res = await fetchWorker('/');
		expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(res.headers.get('X-Frame-Options')).toBe('DENY');
		expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
	});

	it('does NOT send CORS headers to unwhitelisted cross-origin requests', async () => {
		const res = await fetchWorker('/', { headers: { Origin: 'https://evil.example.com' } });
		expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
	});

	it('echoes CORS origin when the origin is whitelisted via ALLOWED_ORIGINS', async () => {
		// 直接构造带 ALLOWED_ORIGINS 的 env 覆盖来验证白名单逻辑
		const request = new IncomingRequest('https://blog.test/', { headers: { Origin: 'https://good.example.com' } });
		const ctx = createExecutionContext();
		const res = await worker.fetch(request, { ...env, ALLOWED_ORIGINS: 'https://good.example.com' }, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://good.example.com');
	});
});

describe('authentication', () => {
	it('rejects /api/auth/me without a token', async () => {
		const res = await fetchWorker('/api/auth/me');
		expect(res.status).toBe(401);
	});

	it('rejects /api/auth/me with a token in the URL query', async () => {
		// URL 传 token 已被禁用（authMiddleware 只认 Authorization header）
		const res = await fetchWorker('/api/auth/me?token=anything');
		expect(res.status).toBe(401);
	});

	it('logs in with correct credentials and returns a JWT', async () => {
		const res = await fetchWorker('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'test@example.com', password: 'Password123' }),
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.success).toBe(true);
		expect(typeof data.data.token).toBe('string');
		expect(data.data.token.split('.').length).toBe(3);
	});

	it('serves the admin dashboard with X-Authenticated for a valid token', async () => {
		const login = await fetchWorker('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'test@example.com', password: 'Password123' }),
		});
		const loginData = await login.json();
		const res = await fetchWorker('/admin', {
			headers: { 'Authorization': 'Bearer ' + loginData.data.token },
		});
		expect(res.status).toBe(200);
		expect(res.headers.get('X-Authenticated')).toBe('true');
		const html = await res.text();
		expect(html).toContain('管理后台');
	});

	it('serves the check-auth page without X-Authenticated when no token', async () => {
		const res = await fetchWorker('/admin');
		expect(res.status).toBe(200);
		expect(res.headers.get('X-Authenticated')).toBeNull();
		const html = await res.text();
		expect(html).toContain('正在验证身份');
	});

	it('rejects wrong password', async () => {
		const res = await fetchWorker('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'test@example.com', password: 'WrongPass1' }),
		});
		expect(res.status).toBe(401);
	});

	it('rate-limits login attempts per IP (5/min)', async () => {
		// 独立 IP，避免与其他测试共享计数
		const attempt = () =>
			fetchWorker('/api/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Forwarded-For': '9.9.9.9',
				},
				body: JSON.stringify({ email: 'test@example.com', password: 'WrongPass1' }),
			});

		for (let i = 0; i < 5; i++) {
			const res = await attempt();
			expect(res.status).toBe(401); // 前 5 次正常返回密码错误
		}
		const sixth = await attempt();
		expect(sixth.status).toBe(429); // 第 6 次被限流
	});
});

describe('markdown rendering (XSS hardening)', () => {
	it('escapes raw HTML in headings', () => {
		const html = renderMarkdown('# <img src=x onerror=alert(1)>');
		expect(html).not.toContain('<img');
		expect(html).toContain('&lt;img');
	});

	it('still renders inline markdown in headings', () => {
		const html = renderMarkdown('## **加粗文本**');
		expect(html).toContain('<strong>加粗文本</strong>');
	});

	it('blocks javascript: URLs in links', () => {
		const html = renderMarkdown('[点我](javascript:alert(1))');
		expect(html).not.toContain('javascript:');
		expect(html).not.toContain('href="javascript:');
	});

	it('blocks javascript: URLs in images', () => {
		const html = renderMarkdown('![x](javascript:alert(1))');
		expect(html).not.toContain('javascript:');
	});

	it('escapes raw HTML inside link text', () => {
		const html = renderMarkdown('[<img src=x onerror=alert(1)>](https://example.com)');
		expect(html).not.toContain('<img');
	});

	it('escapes raw HTML inside blockquotes', () => {
		const html = renderMarkdown('> <script>alert(1)</script>');
		expect(html).not.toContain('<script>');
	});
});
