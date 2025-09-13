import { app } from './app';
import { initStorage } from './storage/azure-blob';
import http from 'http';

const port = process.env.PORT || 5180;
app.listen(port as any, '::', async () => {
	console.log(`API server running on http://localhost:${port} (bound ::)`);
	try {
		await initStorage();
		console.log('[storage] init complete');
	} catch (e:any) {
		console.error('[storage] init failed', e?.message || e);
	}
	setTimeout(() => {
		http.get(`http://127.0.0.1:${port}/health`, (res) => {
			console.log('[self-check] /api/health status', res.statusCode);
		}).on('error', (e) => console.error('[self-check] failed', e.message));
	}, 200);
});
