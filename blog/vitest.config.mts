import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
				miniflare: {
					bindings: {
						// 测试环境注入固定 JWT_SECRET（wrangler.jsonc 中为 {JWT_SECRET} secret 占位符，
						// 本地 dev 用 .dev.vars，测试用此处注入）
						JWT_SECRET: 'test-secret-key-do-not-use-in-prod',
						ALLOWED_ORIGINS: '',
					},
				},
			},
		},
	},
});
