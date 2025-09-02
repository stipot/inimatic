import { SkillModule } from '../skill-host/skill-ctx';

export const hubPingSkill: SkillModule = {
	manifest: { name: 'hub-ping', version: '0.1.0', route: '/hub/ping', capabilities: ['ui', 'net', 'io'] },
	async mount(ctx) {
		const { ui, net, io } = ctx;
		ui.render({
			type: 'stack', gap: 8, padding: 8, children: [
				{ type: 'text', id: 'h1', text: 'hub ping' },
				{ type: 'button', id: 'btn', label: 'ping all' },
				{ type: 'console', id: 'log', height: 220 }
			]
		});
		ui.on('click', 'btn', async () => {
			const out = io.to('text', { target: '#log' });
			const nodes = await net.adaos.get<any[]>('/api/hub/nodes').toPromise();
			for (const n of (nodes || [])) {
				const r = await net.adaos.post<{ latency: number }>('/api/hub/ping', { id: n.id }).toPromise();
				await out.write(`${n.name || n.id}: ${r?.latency ?? '—'} ms`);
			}
		});
	}
};
