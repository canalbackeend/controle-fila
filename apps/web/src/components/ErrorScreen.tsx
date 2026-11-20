import { Component, type ReactNode } from "react";

const devicePage = /^\/(painel|totem)(\/|$)/;

/**
 * Shows a recoverable message instead of a blank page when a screen fails to
 * render. TVs and kiosks have nobody to click, so they reload by themselves.
 */
export class ErrorScreen extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  private timer: number | undefined;

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    if (devicePage.test(window.location.pathname))
      this.timer = window.setTimeout(() => window.location.reload(), 30_000);
  }

  componentWillUnmount() {
    window.clearTimeout(this.timer);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="workspace error-screen" role="alert">
        <h1>Não foi possível abrir esta tela</h1>
        <p>
          O sistema pode ter sido atualizado ou a conexão caiu. Recarregue a
          página para continuar.
        </p>
        <button
          className="primary"
          type="button"
          onClick={() => window.location.reload()}
        >
          Recarregar
        </button>
      </main>
    );
  }
}
