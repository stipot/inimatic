import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject, Observable } from 'rxjs';
import { AdaosConfig, AdaosEvent } from './adaos-types';

@Injectable({ providedIn: 'root' })
export class AdaosClient {
	private ws?: WebSocket;
	private events$ = new Subject<AdaosEvent>();
	private cfg: AdaosConfig;

	constructor(private http: HttpClient) {
		this.cfg = {
			baseUrl: (window as any).__ADAOS_BASE__ ?? '/adaos',
			token: (window as any).__ADAOS_TOKEN__ ?? null,
		};
	}

	setBase(url: string) { this.cfg.baseUrl = url; }
	setToken(token: string | null) { this.cfg.token = token; }

	connect(topics: string[] = []): Observable<AdaosEvent> {
		const u = new URL('/ws', location.origin + this.cfg.baseUrl.replace(/\/$/, ''));
		if (this.cfg.token) u.searchParams.set('token', this.cfg.token);
		this.ws = new WebSocket(u.toString().replace(/^http/, 'ws'));
		this.ws.onopen = () => { if (topics.length) this.subscribe(topics); };
		this.ws.onmessage = (e) => { try { this.events$.next(JSON.parse(e.data)); } catch { } };
		this.ws.onerror = () => this.events$.next({ type: 'error', message: 'ws error' });
		this.ws.onclose = () => this.events$.complete();
		return this.events$.asObservable();
	}

	subscribe(topics: string[]) {
		this.ws?.send(JSON.stringify({ type: 'subscribe', topics }));
	}

	get<T>(path: string) { return this.http.get<T>(this.url(path), { headers: this.h() }); }
	post<T>(path: string, body?: any) { return this.http.post<T>(this.url(path), body ?? {}, { headers: this.h() }); }

	say(text: string) { return this.post('/api/say', { text }); }
	callSkill<T = any>(skill: string, method: string, body?: any) {
		return this.post<T>(`/api/skills/${skill}/${method}`, body ?? {});
	}

	private url(path: string) { return new URL(path, this.cfg.baseUrl).toString(); }
	private h() { return this.cfg.token ? new HttpHeaders({ 'X-AdaOS-Token': this.cfg.token }) : undefined; }
}
