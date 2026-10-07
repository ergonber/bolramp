import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cómo funciona Bolramp",
  description:
    "Paso a paso: convierte Bolivianos a USDT en Polygon en minutos con tu propia wallet.",
};

/**
 * TODO_VIDEO_METAMASK: pega aqui la URL completa del video de YouTube
 * (ejemplo: "https://www.youtube.com/watch?v=XXXXXXXXXXX").
 * Dejala vacia ("") mientras no tengas la URL: el enlace no se mostrara.
 */
const METAMASK_VIDEO_URL = ""; // TODO_VIDEO_METAMASK

/**
 * TODO_VIDEO_RABBY: pega aqui la URL completa del video de YouTube
 * (ejemplo: "https://www.youtube.com/watch?v=XXXXXXXXXXX").
 * Dejala vacia ("") mientras no tengas la URL: el enlace no se mostrara.
 */
const RABBY_VIDEO_URL = ""; // TODO_VIDEO_RABBY

const WALLET_SETUP_STEPS = [
  "Instala la extensión en tu navegador (o descarga la app móvil).",
  "Crea una wallet nueva y define tu contraseña de acceso.",
  "Guarda la frase semilla (12 o 24 palabras) en un lugar seguro. Nunca la compartas con nadie.",
  "Agrega la red Polygon (mainnet) a tu wallet.",
];

const STEPS = [
  {
    n: 1,
    title: "Conecta tu wallet",
    body: "Presiona el botón “Conectar wallet” del sitio y elige MetaMask o Rabby. Conectamos solo para saber a qué dirección enviarte el USDT.",
  },
  {
    n: 2,
    title: "Completa el KYC",
    body: "Ingresa tus datos personales. Son validados con el SEGIP (registro civil de Bolivia) para cumplir con la normativa. Solo se hace una vez.",
  },
  {
    n: 3,
    title: "Ingresa el monto y revisa la cotización",
    body: "Escribe cuántos Bolivianos (BOB) quieres convertir y revisa el tipo de cambio y la cantidad de USDT que recibirás antes de continuar.",
  },
  {
    n: 4,
    title: "Escanea el QR y paga",
    body: "Escanea el código QR con la app de tu banco o billetera móvil y realiza la transferencia en Bolivianos desde tu cuenta habitual.",
  },
  {
    n: 5,
    title: "Recibe el USDT en tu wallet",
    body: "En pocos minutos el USDT llega a tu dirección en la red Polygon. Ábrelo en MetaMask o Rabby importando el token USDT para ver el saldo.",
  },
];

const FAQ = [
  {
    q: "¿Bolramp guarda mi dinero?",
    a: "No. Bolramp no custodia fondos: el USDT va directo desde nuestro pool a la wallet que tú conectas.",
  },
  {
    q: "¿Necesito una cuenta en un banco cripto?",
    a: "No. Pagas desde tu banco o app móvil tradicional en Bolivianos, como cualquier transferencia.",
  },
  {
    q: "¿Cuánto tarda el proceso?",
    a: "Minutos. Tras confirmar el pago, el USDT se envía a tu wallet en Polygon casi de inmediato.",
  },
  {
    q: "¿Qué red usa Bolramp?",
    a: "Polygon mainnet. Asegúrate de tener la red Polygon agregada en tu wallet para ver los fondos.",
  },
  {
    q: "¿Puedo perder el dinero si uso una wallet que no controlo?",
    a: "Sí. Si conectas la wallet de otra persona, el USDT llega a esa dirección y el dueño podrá usarlo. Usa siempre una wallet que controles tú.",
  },
];

function StepBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-blue-500/25 to-purple-500/25 border border-blue-400/30 text-sm font-bold text-blue-300">
      {children}
    </span>
  );
}

export default function ComoFuncionaPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
      <div className="text-center mb-10 animate-fadeIn">
        <h1 className="text-4xl sm:text-5xl font-bold mb-3">
          <span className="text-gradient">¿Cómo funciona Bolramp?</span>
        </h1>
        <p className="text-slate-400 text-base sm:text-lg">
          Convierte Bolivianos a USDT en Polygon en minutos, sin cuentas cripto y sin custodiar tu dinero.
        </p>
      </div>

      <section
        className="glass-card rounded-3xl p-6 sm:p-8 mb-6 animate-scaleIn"
        style={{ borderColor: "rgba(251, 191, 36, 0.35)" }}
      >
        <div className="flex items-start gap-3 mb-4">
          <StepBadge>0</StepBadge>
          <div>
            <h2 className="text-xl font-semibold text-white">Necesitas una wallet propia en Polygon</h2>
            <p className="text-slate-400 text-sm mt-1">
              Antes de comprar, revisa este paso. Es el más importante de todo el proceso.
            </p>
          </div>
        </div>

        <div className="space-y-4 text-slate-200 text-sm sm:text-base leading-relaxed">
          <p>
            El USDT <strong className="text-white">llega a la dirección de TU wallet</strong> en la red Polygon.
            Por ejemplo: <code className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-blue-300 text-xs">0xB141...E9A6</code>.
            Quien tenga esa dirección y su frase semilla, tiene ese dinero.
          </p>

          <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
            <p className="text-amber-200 font-medium">
              Si conectas la wallet de otra persona, el dinero llegará a ESA persona. Usa siempre una wallet que
              controles.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-2">¿Cómo crear una?</h3>
            <p className="text-slate-400 mb-3">
              Te recomendamos MetaMask o Rabby. Ambas son gratuitas y funcionan en navegador y móvil:
            </p>
            <ol className="space-y-2 mb-5">
              {WALLET_SETUP_STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 text-slate-300">
                  <span className="text-blue-400 font-semibold shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h4 className="text-white font-semibold mb-1">MetaMask</h4>
                <p className="text-slate-400 text-sm mb-3">
                  La wallet más usada. Ideal si recién empiezas.
                </p>
                <div className="flex flex-col gap-2 text-sm">
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30 hover:bg-blue-500/30 transition-colors duration-200 font-medium"
                  >
                    Descargar MetaMask
                  </a>
                  {METAMASK_VIDEO_URL ? (
                    // TODO_VIDEO_METAMASK: reemplaza METAMASK_VIDEO_URL por la URL del video de YouTube.
                    <a
                      href={METAMASK_VIDEO_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white transition-colors duration-200"
                    >
                      Ver video tutorial
                    </a>
                  ) : (
                    // TODO_VIDEO_METAMASK: pega la URL del video de YouTube en METAMASK_VIDEO_URL.
                    <span className="text-center px-4 py-2 rounded-xl text-slate-500 border border-dashed border-white/10">
                      Video tutorial (próximamente)
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h4 className="text-white font-semibold mb-1">Rabby</h4>
                <p className="text-slate-400 text-sm mb-3">
                  Moderna y segura, detecta la red automáticamente.
                </p>
                <div className="flex flex-col gap-2 text-sm">
                  <a
                    href="https://rabby.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30 hover:bg-purple-500/30 transition-colors duration-200 font-medium"
                  >
                    Descargar Rabby
                  </a>
                  {RABBY_VIDEO_URL ? (
                    // TODO_VIDEO_RABBY: reemplaza RABBY_VIDEO_URL por la URL del video de YouTube.
                    <a
                      href={RABBY_VIDEO_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white transition-colors duration-200"
                    >
                      Ver video tutorial
                    </a>
                  ) : (
                    // TODO_VIDEO_RABBY: pega la URL del video de YouTube en RABBY_VIDEO_URL.
                    <span className="text-center px-4 py-2 rounded-xl text-slate-500 border border-dashed border-white/10">
                      Video tutorial (próximamente)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-slate-400 text-sm mt-4">
              Red Polygon: <strong className="text-slate-200">Polygon Mainnet</strong> — en MetaMask/Rabby puedes
              agregarla desde la lista de redes predefinidas o con el botón “Agregar red”.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4 mb-10">
        {STEPS.map((step) => (
          <article key={step.n} className="glass-card rounded-3xl p-6 flex items-start gap-4 animate-fadeIn">
            <StepBadge>{step.n}</StepBadge>
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">{step.title}</h2>
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed">{step.body}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="glass-card rounded-3xl p-6 sm:p-8 mb-8">
        <h2 className="text-xl font-semibold text-white mb-5">Preguntas frecuentes</h2>
        <dl className="space-y-5">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="text-slate-200 font-medium mb-1">{item.q}</dt>
              <dd className="text-slate-400 text-sm sm:text-base leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="glass-card rounded-3xl p-6 sm:p-8 text-center">
        <h2 className="text-xl font-semibold text-white mb-2">¿Listo para empezar?</h2>
        <p className="text-slate-400 text-sm mb-5">
          Conecta tu wallet y convierte tus Bolivianos en USDT en pocos minutos.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/comprar"
            className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/25 transition-all duration-300"
          >
            Conectar wallet
          </a>
          <a
            href="/kyc"
            className="px-6 py-3 rounded-xl font-semibold text-slate-200 border border-white/10 bg-white/5 hover:bg-white/10 transition-colors duration-200"
          >
            Ir a KYC
          </a>
        </div>
      </section>
    </div>
  );
}
