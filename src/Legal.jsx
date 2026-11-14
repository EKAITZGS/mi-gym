// Privacidad y condiciones de uso, dentro de la app (sin páginas externas).
import { useState } from 'react'
import { Modal } from './ui'

export const LEGAL_VERSION = '2026-11'

export default function LegalModal({ onClose, tab: tab0 = 'privacy' }) {
  const [tab, setTab] = useState(tab0)
  return (
    <Modal title="Privacidad y condiciones" onClose={onClose}>
      <div className="seg">
        <button className={tab === 'privacy' ? 'on' : ''} onClick={() => setTab('privacy')}>
          Privacidad
        </button>
        <button className={tab === 'terms' ? 'on' : ''} onClick={() => setTab('terms')}>
          Condiciones
        </button>
      </div>
      {tab === 'privacy' ? (
        <div className="legal">
          <p className="muted small">Versión {LEGAL_VERSION}. Escrito para que se entienda, no para que no se lea.</p>
          <h4>Qué datos guarda MI-GYM</h4>
          <p>Lo que tú apuntas: rutina, entrenos (series, pesos, repeticiones, sensaciones y molestias), comidas, peso y cintura, fotos de progreso, y las preferencias de la app. Si conectas un reloj Polar: entrenos con pulso, pasos, calorías, sueño y recarga nocturna.</p>
          <h4>Dónde están</h4>
          <ul>
            <li><b>En tu móvil</b> siempre (almacenamiento local). Las fotos de progreso solo están en tu móvil: nunca se suben.</li>
            <li><b>En tu cuenta</b> (Supabase): una copia de tus datos (sin fotos) para no perderlos y poder usar otro dispositivo. Solo tú puedes leerla, salvo lo que autorices a un entrenador.</li>
          </ul>
          <h4>Quién puede verlos</h4>
          <p>Nadie, salvo que aceptes a un entrenador dentro de la app: entonces ve tu rutina, tus entrenos, tu peso y cintura y el pulso de tus entrenos del reloj. No ve tu dieta, tu sueño ni tus fotos. Puedes dejar al entrenador cuando quieras y deja de ver todo.</p>
          <h4>Servicios de terceros que usa la app</h4>
          <ul>
            <li><b>Polar</b> (si lo conectas): la app lee tus datos con tu permiso. Puedes revocarlo en Perfil → Reloj → Desconectar.</li>
            <li><b>Groq</b> (IA, opcional): cuando usas el entrenador IA o la foto de un plato, se envía un resumen de tus datos de entreno o esa foto para obtener la respuesta. No se usa para nada más.</li>
            <li><b>Open Food Facts</b>: para buscar productos por nombre o código de barras (solo se envía la búsqueda).</li>
            <li><b>Cloudflare</b>: intermediario técnico para Polar, IA y avisos; no guarda tus datos de entreno.</li>
          </ul>
          <h4>Cuánto tiempo y cómo borrarlos</h4>
          <p>Mientras tengas cuenta. En Perfil → Ajustes puedes exportar una copia, borrar todos tus datos o eliminar la cuenta entera (datos, perfil y usuario). El borrado es inmediato e irreversible.</p>
          <h4>Lo que no hacemos</h4>
          <p>No hay publicidad, no se venden ni comparten datos, no hay rastreadores de terceros.</p>
        </div>
      ) : (
        <div className="legal">
          <p className="muted small">Versión {LEGAL_VERSION}.</p>
          <h4>Qué es</h4>
          <p>MI-GYM es una app para planificar y registrar entrenamientos de fuerza, la alimentación y la recuperación, y ver tu progreso.</p>
          <h4>No es consejo médico</h4>
          <p>Las recomendaciones, los cálculos de calorías y los análisis (incluidos los del entrenador IA) son orientativos y se basan solo en lo que tú apuntas. No sustituyen a un médico, dietista o entrenador titulado. Si tienes dolor fuerte, mareos o una lesión, para y consulta a un profesional.</p>
          <h4>Tu cuenta</h4>
          <p>Eres responsable de tu contraseña y de lo que apuntas. Puedes cerrar la cuenta cuando quieras desde Ajustes.</p>
          <h4>Entrenadores</h4>
          <p>Un entrenador solo accede a lo que tú aceptes dentro de la app y solo mientras mantengas la relación. Sus propuestas no cambian nada hasta que tú las aceptas.</p>
          <h4>Disponibilidad</h4>
          <p>La app funciona sin conexión con lo guardado en tu móvil. Los servicios externos (Polar, IA, búsqueda de productos) pueden fallar o cambiar; la app lo indica y sigue funcionando sin ellos.</p>
          <h4>Créditos</h4>
          <p>Fotos de ejercicios de free-exercise-db (dominio público). Datos de productos de Open Food Facts (licencia abierta). Los valores de la lista de alimentos propia son aproximados.</p>
        </div>
      )}
    </Modal>
  )
}
