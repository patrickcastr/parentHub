import { app } from './app';
import { initStorage } from './storage/azure-blob';
import http from 'http';

const port = Number(process.env.PORT ?? 8080);
app.listen(port, '0.0.0.0', async () => {
	console.log(`🚀 Server running on port ${port}`);
	try {
		await initStorage();
		console.log('[storage] init complete');
	} catch (e:any) {
		console.error('[storage] init failed', e?.message || e);
	}
	setTimeout(() => {
		http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
			console.log('[self-check] /api/health status', res.statusCode);
		}).on('error', (e) => console.error('[self-check] failed', e.message));
	}, 200);
});
