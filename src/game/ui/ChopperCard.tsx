import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useStore } from 'zustand';
import { NeutralToneMapping, type Group, type PerspectiveCamera } from 'three';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import type { GameController } from '../controller';
import { selectReducedMotion } from '../state/store';
import { buildChopper } from '../world/chopper/build';
import type { Clip } from '../world/chopper/anim';
import { CHOPPER } from '../world/chopper/profile';
import { Icon } from './Icon';
import { spaceBack } from '../input/keyboard';

/** The little doggy things he does beside his card, in random order (never the same twice running). */
const CARD_IDLES: ReadonlyArray<{ clip: Clip; dur: [number, number]; wag: number; pant?: boolean }> = [
  { clip: 'sit', dur: [3, 5], wag: 0.5 },
  { clip: 'scratch', dur: [2.4, 2.8], wag: 0.2 },
  { clip: 'pant', dur: [3, 4.5], wag: 0.6, pant: true },
  { clip: 'sniffGround', dur: [2.5, 3.5], wag: 0.2 },
  { clip: 'headTilt', dur: [1.8, 2.4], wag: 0.7 },
  { clip: 'lie', dur: [3.5, 5], wag: 0.15 },
  { clip: 'shake', dur: [1.1, 1.1], wag: 0.3 },
  { clip: 'playBow', dur: [2, 2.6], wag: 1 },
  { clip: 'stand', dur: [2, 3], wag: 0.8, pant: true },
];

/** He sits on a soft shadow in his own small canvas: cycling idles, and a drag turns him. */
function StageDog({ yaw, reduced }: { yaw: { current: number }; reduced: boolean }) {
  const body = useMemo(() => buildChopper(20, { lamps: false, shadows: false, ownGeometry: true }), []);
  useEffect(() => () => body.dispose(), [body]);
  const group = useRef<Group>(null);
  const idle = useRef({ i: 0, t: 0, dur: 3, last: -1, barkAge: 99 });
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = idle.current;
    s.t += dt;
    s.barkAge += dt;
    if (s.t > s.dur) {
      let next = Math.floor(Math.random() * CARD_IDLES.length);
      if (next === s.i) next = (next + 1 + Math.floor(Math.random() * (CARD_IDLES.length - 1))) % CARD_IDLES.length;
      s.last = s.i;
      s.i = next;
      s.t = 0;
      const d = CARD_IDLES[next].dur;
      s.dur = d[0] + Math.random() * (d[1] - d[0]);
      if (CARD_IDLES[next].clip === 'playBow') s.barkAge = -0.6;
    }
    const cur = CARD_IDLES[s.i];
    body.anim.update(dt, {
      speed: 0,
      turn: 0,
      clip: cur.clip,
      clipTime: s.t,
      wag: cur.wag,
      look: cur.clip === 'sit' || cur.clip === 'headTilt' || cur.clip === 'pant' ? { yaw: 0.25, pitch: -0.15 } : null,
      barkAge: s.barkAge,
      pant: cur.pant ? 1 : 0,
      reduced,
    });
    body.uniforms.uTime.value += dt;
    const g = group.current;
    if (g) g.rotation.y += (yaw.current - g.rotation.y) * (1 - Math.exp(-dt * 10));
  });
  return (
    <group ref={group}>
      <primitive object={body.mesh} />
      <mesh rotation-x={-Math.PI / 2} position-y={0.001}>
        <circleGeometry args={[0.36, 40]} />
        <meshBasicMaterial color="#6b5a48" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Keep all of him in view whatever the stage's shape (he's about 0.7 u long and 0.5 u tall). */
function FitCamera() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const t = Math.tan(((camera.fov / 2) * Math.PI) / 180);
    const aspect = size.width / Math.max(1, size.height);
    const dist = Math.max(0.6 / (2 * t), 0.66 / (2 * t * aspect));
    camera.position.set(0, 0.24 + dist * 0.18, dist);
    camera.lookAt(0, 0.23, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Stage({ reduced }: { reduced: boolean }) {
  const yaw = useRef(-0.55);
  const drag = useRef<{ id: number; x: number; start: number } | null>(null);
  return (
    <div
      className="chopper-stage"
      data-testid="chopper-3d"
      role="img"
      aria-label="A 3D Chopper beside his card, doing little doggy things: sitting, scratching, panting, sniffing, a play bow. Drag to turn him."
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { id: e.pointerId, x: e.clientX, start: yaw.current };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d && d.id === e.pointerId) yaw.current = d.start + (e.clientX - d.x) * 0.012;
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <StageBoundary>
        <Canvas
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
          camera={{ fov: 26, near: 0.05, far: 10, position: [0, 0.42, 1.55] }}
          onCreated={({ gl }) => {
            gl.toneMapping = NeutralToneMapping;
            gl.toneMappingExposure = 1.05;
            gl.domElement.setAttribute('aria-hidden', 'true');
          }}
        >
          <hemisphereLight args={['#fff4e2', '#9a8a76', 1.9]} />
          <directionalLight position={[1.2, 2, 1.6]} intensity={2.8} color="#fff1dc" />
          <directionalLight position={[-1.5, 0.8, -1]} intensity={0.9} color="#cfe0ff" />
          <FitCamera />
          <StageDog yaw={yaw} reduced={reduced} />
        </Canvas>
      </StageBoundary>
    </div>
  );
}

/** "Meet Chopper": his real photo, his details and a 3D Chopper doing doggy things (chopper.md §5). */
export default function ChopperCard({ controller }: { controller: GameController }) {
  const open = useStore(controller.store, (s) => s.chopperOpen);
  const reduced = useStore(controller.store, selectReducedMotion);
  const ref = useRef<HTMLDialogElement>(null);
  const [photo, setPhoto] = useState(0);
  const P = CHOPPER;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const close = () => controller.closeChopper();
  const shown = P.photos[photo];
  return (
    <dialog
      ref={ref}
      className="dialog chopper-dialog"
      aria-labelledby="chopper-title"
      data-testid="chopper-dialog"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={(e) => {
        if (!spaceBack(e)) return;
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {open && (
        <div className="dialog-body chopper-body">
          <button type="button" className="btn icon-btn chopper-close" aria-label="Close" onClick={close}>
            <Icon icon={faXmark} />
          </button>
          <figure className="chopper-photo">
            <img src={shown.src} alt={shown.alt} width={shown.width} height={shown.height} decoding="async" data-testid="chopper-photo" />
            {P.photos.length > 1 && (
              <div className="chopper-thumbs" role="group" aria-label="Photos of Chopper">
                {P.photos.map((p, i) => (
                  <button key={p.src} type="button" className={`chopper-thumb${i === photo ? ' selected' : ''}`} aria-pressed={i === photo} aria-label={`Photo ${i + 1}`} onClick={() => setPhoto(i)}>
                    <img src={p.src} alt="" width={64} height={Math.round((64 * p.height) / p.width)} decoding="async" />
                  </button>
                ))}
              </div>
            )}
          </figure>
          <div className="chopper-text">
            <p className="kicker">In loving memory</p>
            <h2 id="chopper-title">{P.name}</h2>
            {P.nickname && <p className="muted">“{P.nickname}”</p>}
            <dl className="chopper-facts">
              <dt>Breed</dt>
              <dd>{P.breed}</dd>
              <dt>Coat</dt>
              <dd>{P.coat}</dd>
              {P.years && (
                <>
                  <dt>Years</dt>
                  <dd>{P.years}</dd>
                </>
              )}
            </dl>
            {P.story && <p>{P.story}</p>}
            {P.favourites && P.favourites.length > 0 && (
              <>
                <h3>His favourite things</h3>
                <ul>
                  {P.favourites.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </>
            )}
            <h3>On the planet</h3>
            <ul className="chopper-list">
              {P.onThePlanet.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="chopper-memorial">{P.memorial}</p>
          </div>
          <Stage reduced={reduced} />
        </div>
      )}
    </dialog>
  );
}
