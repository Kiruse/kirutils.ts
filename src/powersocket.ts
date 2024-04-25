import { Event } from '@kiruse/typed-events';
import { getBackoffTimeout } from './misc.js';

/**
 * `PowerSocket` is a reconnecting & extensible wrapper around WebSockets using exponential backoff.
 * It emits various events to manage the connection lifecycle.
 *
 * A big departure from the underlying WebSockets usage pattern is that `PowerSocket` is designed to
 * provide a stable instance. It is designed to represent a single stateful connection to a remote
 * endpoint, not a single-use connection that must be re-created whenever the connection is lost.
 *
 * It also sports a complementary `Heartrate` class to trigger (and possibly receive) regular
 * heartbeats to maintain a connection. Some connections can degrade over time when not in active
 * use, and heartbeats can help keep the connection alive and responsive.
 */
export class PowerSocket<T = string | Buffer> {
  #ws: WebSocket | undefined;
  #connected = false;
  #reconnecting = false;
  #reconnectAttempt = 0;
  connectTimeout = 1500;

  /** Event emitted whenever a message has been received. */
  readonly onMessage = Event<T>();
  /** Event emitted when the connection was successfully established. Deriving protocols may need to
   * implement a handshake on top of this event. This event is emitted only once per connection,
   * including across reconnections.
   */
  readonly onConnect = Event();
  /** Event emitted when the connection was dropped unexpectedly. The `PowerSocket` will attempt to re-establish the connection. */
  readonly onDisconnect = Event();
  /** Event emitter when the connection was previously dropped unexpectedly but has now been re-established.
   * This event is emitted independently of `onConnect`.
   */
  readonly onReconnect = Event();
  /** Event emitted when the connection was terminated normally, i.e. when `close` was called, or a close event was received where `shouldReconnect` returned false. */
  readonly onClose = Event<{ code: number, source: 'local' | 'remote' }>();
  /** Event emitted whenever an error is encountered, either from the underlying WebSocket or this library's extension. */
  readonly onError = Event<any>();

  /**
   * Attempt to connect to the Discord Gateway.
   * @param resume Whether we expect to resume a previous session. Throws if true but cannot resume.
   * @returns
   * @throws {StateError} if already connected. The error is emitted as onError event.
   */
  connect() {
    if (this.#ws) {
      this.onError.emit(new PowerSocketStateError('Already connected/connecting'));
      return this;
    }

    try {
      this.#ws = new WebSocket(this.getConnectUrl());
      this.#ws.onopen = this.#onOpen;
      this.#ws.onclose = this.#onClose;
      this.#ws.onmessage = this.#onMessage;
      this.#ws.onerror = (err) => this.onError.emit(err);
      return this;
    } catch (err) {
      this.onError.emit(err);
    }
  }

  reconnect(closeCode = 1000) {
    const attempt = this.#reconnectAttempt++;
    this.#reconnecting = true;
    // cleanup before close prevents onClose callback from being called
    this.#cleanup();
    this.#ws?.close(closeCode);

    console.log(`Reconnecting in ${getBackoffTimeout(attempt)}ms`);
    const timeout = setTimeout(() => {
      this.connect();
      closer();
    }, getBackoffTimeout(attempt));
    const closer = this.onClose.once(() => clearTimeout(timeout));
  }

  close(closeCode = 1000, reason?: string) {
    this.#connected = false;
    this.#reconnecting = false;
    // cleanup before close prevents onClose callback from being called
    this.#cleanup();
    this.#ws?.close(closeCode, reason);
    this.onClose.emit({ code: closeCode, source: 'local' });
    return this;
  }

  send(data: any) {
    if (!this.#ws) throw new PowerSocketError('WebSocket not connected');
    this.#ws.send(JSON.stringify(this.marshalMessage(data)));
    return this;
  }

  #cleanup() {
    const ws = this.#ws;
    if (!ws) return;
    this.#ws = undefined;
    ws.onopen = null;
    ws.onclose = null;
    ws.onmessage = null;
    ws.onerror = null;
  }

  #onOpen = () => {
    this.#reconnectAttempt = 0;
    this.#connected = true;
    this.onConnect.emit();
    if (this.#reconnecting) {
      this.#reconnecting = false;
      this.onReconnect.emit();
    } else {
      this.#reconnecting = false;
      this.onConnect.emit();
    }
  }

  #onClose = (e: CloseEvent) => {
    this.onDisconnect.emit({ code: e.code });
    this.#connected = false;

    if (this.shouldReconnect(e.code)) {
      this.reconnect();
    } else {
      this.onClose.emit({ code: e.code, source: 'remote' });
      this.#cleanup();
    }
  }

  #onMessage = (e: MessageEvent) => {
    this.onMessage.emit(this.unmarshalMessage(e.data) as any);
  }

  getConnectUrl(): string {
    throw Error('PowerSocket.getConnectUrl must be manually implemented or provided.');
  }

  /** Transformations to apply to the message to be sent to the remote. Defaults to no transformations. */
  marshalMessage(data: any): any {
    return data;
  }

  /** Transformations to apply to the body of a message received from the remote. Defaults to no transformations. */
  unmarshalMessage(data: any): unknown {
    return data;
  }

  /** Whether the socket should attempt to reconnect to the remote endpoint. The standard behavior
   * is to always attempt to reconnect unless the close code is 1000 (Normal Closure).
   */
  shouldReconnect(code: number) {
    return code !== 1000;
  }

  get connected() { return this.#connected }
  get reconnecting() { return this.#reconnecting }
}

export class PowerSocketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class PowerSocketTimeoutError extends PowerSocketError {
  constructor(attempt: number) {
    super(`Connection attempt timed out after ${attempt} attempts`);
  }
}

export class PowerSocketStateError extends PowerSocketError {
  constructor(message: string) {
    super(message);
  }
}
