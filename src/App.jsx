import { useEffect, useState } from "react";
import { Routes, Route, useParams } from "react-router-dom";
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";

const money = (cents) => `$${Math.round(cents / 100).toLocaleString("es-AR")}`;
const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const participantAmount = (account, participant) =>
  (account.items || []).reduce((total, item) => {
    const quantity = Number(participant.selections?.[item.id] || 0);
    if (!quantity) return total;
    const units = Math.max(1, item.quantity);
    const unit = Math.floor(item.totalCents / units);
    return (
      total + quantity * unit + Math.min(quantity, item.totalCents % units)
    );
  }, 0);

function LandingPage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <img
          className="landing-logo"
          src="/assets/logo_tedebo.png"
          alt="Te Debo"
        />
      </nav>
      <section className="landing-hero">
        <div className="landing-copy">
          <div className="eyebrow">Dividí la cuenta, sin hacer cuentas.</div>
          <h1>
            La forma más simple de dividir cuentas
            <span> con amigos.</span>
          </h1>
          <p>
            En bares, restaurantes o donde sea. Sacale una foto al ticket, elegí
            cómo dividirlo y compartí un link.
          </p>
          <button
            className="store-button"
            disabled
            aria-label="Descargar en Google Play próximamente"
          >
            <span className="store-copy">
              <small>Descargar en</small>
              Google Play
            </span>
          </button>
          <div className="feature-row" id="beneficios">
            <div className="feature-item">
              <span className="feature-icon">▤</span>
              <div>
                <strong>Rápido</strong>
                <span>Subí la foto del ticket y listo.</span>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">↗</span>
              <div>
                <strong>Compartí</strong>
                <span>Enviá el link a tus amigos.</span>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">♧</span>
              <div>
                <strong>Dividí</strong>
                <span>Cada uno paga lo suyo.</span>
              </div>
            </div>
          </div>
        </div>
        <div className="landing-art">
          <div className="art-glow" />
          <img
            className="landing-wallet"
            src="/assets/wallet.png"
            alt="Billetera de Te Debo"
          />
        </div>
      </section>
      <section className="how-section" id="como-funciona">
        <div className="how-heading">
          <span className="section-line" />
          <h2>Así de fácil</h2>
          <span className="section-line" />
        </div>
        <div className="steps-row">
          <div className="step-item">
            <span className="step-number">1</span>
            <div>
              <h3>
                Sacá una foto
                <br />
                del ticket
              </h3>
              <p>Te Debo detecta los productos automáticamente.</p>
            </div>
          </div>
          <div className="step-item">
            <span className="step-number">2</span>
            <div>
              <h3>
                Revisá los
                <br />
                productos
              </h3>
              <p>Podés editar cantidades o agregar lo que falte.</p>
            </div>
          </div>
          <div className="step-item">
            <span className="step-number">3</span>
            <div>
              <h3>
                Decidí quién
                <br />
                pagó
              </h3>
              <p>Indicá quién abonó la cuenta completa.</p>
            </div>
          </div>
          <div className="step-item">
            <span className="step-number">4</span>
            <div>
              <h3>
                Compartí el link
                <br />y cada uno elige
              </h3>
              <p>Tus amigos eligen lo que consumieron y pagan su parte.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function NameStep({ onSubmit, loading }) {
  const [name, setName] = useState("");
  return (
    <main className="page">
      <section className="container name-page">
        <div className="logo">
          Te <span>Debo</span>
        </div>
        <div className="name-card">
          <div className="eyebrow">Una cuenta compartida</div>
          <h1>¿Cómo te llamás?</h1>
          <p>Así todos pueden reconocer qué parte elegiste.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(name.trim());
            }}
          >
            <label htmlFor="guest-name">Tu nombre</label>
            <input
              id="guest-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Nico"
              autoFocus
              maxLength={60}
            />
            <button
              className="confirm-button"
              disabled={!name.trim() || loading}
            >
              {loading ? "CARGANDO..." : "CONTINUAR"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function AccountPage() {
  const { slug } = useParams();
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");
  const [guestName, setGuestName] = useState(
    () => localStorage.getItem(`tedebo-name-${slug}`) || "",
  );
  const [participantId, setParticipantId] = useState(
    () => localStorage.getItem(`tedebo-participant-${slug}`) || "",
  );
  const [joining, setJoining] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!slug) return undefined;
    return onSnapshot(
      doc(db, "shared_accounts", slug),
      (snapshot) => {
        if (!snapshot.exists()) {
          setError("No encontramos una cuenta con ese código.");
          return;
        }
        const data = snapshot.data();
        const expiresAt = data.expiresAt;
        const createdAt =
          typeof data.createdAt === "string" ? new Date(data.createdAt) : null;
        const expiration =
          expiresAt instanceof Timestamp
            ? expiresAt.toDate()
            : createdAt
              ? new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000)
              : null;
        if (expiration && expiration <= new Date()) {
          setError(
            "Este link venció. Pedile al creador que genere una cuenta nueva.",
          );
          return;
        }
        setAccount({ id: snapshot.id, ...data });
        setError("");
      },
      () =>
        setError(
          "No pudimos cargar la cuenta. Revisá la conexión e intentá de nuevo.",
        ),
    );
  }, [slug]);

  const joinAccount = async (name) => {
    if (!name || !account) return;
    setJoining(true);
    const requestedId = participantId || newId();
    let selectedId = requestedId;
    try {
      await runTransaction(db, async (transaction) => {
        const reference = doc(db, "shared_accounts", slug);
        const snapshot = await transaction.get(reference);
        const latest = snapshot.data();
        const participants = [...(latest.participants || [])];
        const existing = participants.find((entry) => entry.id === requestedId);
        const placeholder = participants.find(
          (entry) => !entry.isCreator && !entry.name,
        );
        const participant = existing ||
          placeholder || {
            id: requestedId,
            name: "",
            amountCents: 0,
            status: "pending",
            isCreator: false,
            selections: {},
          };
        selectedId = participant.id;
        participant.name = name;
        participant.status =
          participant.selections && Object.keys(participant.selections).length
            ? "selecting"
            : "pending";
        if (!existing && !placeholder) participants.push(participant);
        transaction.update(reference, {
          participants,
          updatedAt: serverTimestamp(),
        });
      });
      setParticipantId(selectedId);
      setGuestName(name);
      localStorage.setItem(`tedebo-name-${slug}`, name);
      localStorage.setItem(`tedebo-participant-${slug}`, selectedId);
    } catch {
      setError("No pudimos registrarte en la cuenta. Intentá de nuevo.");
    } finally {
      setJoining(false);
    }
  };

  const participant = account?.participants?.find(
    (entry) => entry.id === participantId,
  );
  const myPart = participant ? participantAmount(account, participant) : 0;
  const assignedPart = participant?.amountCents || 0;
  const isItemMode = account?.mode === "items";
  const paidAmount = (account?.participants || [])
    .filter((entry) => entry.status === "paid")
    .reduce((total, entry) => total + (entry.amountCents || 0), 0);

  const changeSelection = async (item, amount) => {
    if (!participant || !account) return;
    try {
      await runTransaction(db, async (transaction) => {
        const reference = doc(db, "shared_accounts", slug);
        const snapshot = await transaction.get(reference);
        const latest = snapshot.data();
        const participants = [...(latest.participants || [])];
        const current = participants.find(
          (entry) => entry.id === participant.id,
        );
        if (!current) return;
        const currentQuantity = Number(current.selections?.[item.id] || 0);
        const usedByOthers =
          participants.reduce(
            (total, entry) => total + Number(entry.selections?.[item.id] || 0),
            0,
          ) - currentQuantity;
        const next = Math.max(
          0,
          Math.min(item.quantity - usedByOthers, currentQuantity + amount),
        );
        current.selections = { ...(current.selections || {}) };
        if (next) current.selections[item.id] = next;
        else delete current.selections[item.id];
        current.amountCents = participantAmount(latest, current);
        current.status = Object.keys(current.selections).length
          ? "selecting"
          : "pending";
        transaction.update(reference, {
          participants,
          updatedAt: serverTimestamp(),
        });
      });
    } catch {
      setError("No pudimos guardar ese cambio. Intentá de nuevo.");
    }
  };

  const updateStatus = async (status) => {
    if (!participant) return;
    await runTransaction(db, async (transaction) => {
      const reference = doc(db, "shared_accounts", slug);
      const snapshot = await transaction.get(reference);
      const participants = [...(snapshot.data().participants || [])];
      const current = participants.find((entry) => entry.id === participant.id);
      if (current) current.status = status;
      transaction.update(reference, {
        participants,
        updatedAt: serverTimestamp(),
      });
    });
  };

  if (error && !account)
    return (
      <main className="page">
        <section className="container confirmation-page">
          <div className="confirmation-icon">!</div>
          <h1>Cuenta no disponible</h1>
          <p className="confirmation-subtitle">{error}</p>
        </section>
      </main>
    );
  if (!account)
    return (
      <main className="page">
        <section className="container confirmation-page">
          <div className="confirmation-icon">...</div>
          <h1>Cargando cuenta</h1>
        </section>
      </main>
    );
  if (!guestName || !participant)
    return <NameStep onSubmit={joinAccount} loading={joining} />;

  if (confirmed) {
    const percentage = Math.min(
      100,
      Math.round((paidAmount / account.totalCents) * 100),
    );
    return (
      <main className="page">
        <section className="container confirmation-page">
          <div className="confirmation-icon">{paid ? "OK" : "Listo"}</div>
          <h1>{paid ? "Pago registrado" : "Selección registrada"}</h1>
          <p className="confirmation-subtitle">{guestName}, tu parte es</p>
          <strong className="confirmation-total">
            {money(isItemMode ? myPart : assignedPart)}
          </strong>
          <div className="thanks-card">
            <p>La cuenta de {account.creatorName} está al día.</p>
            <span>El creador verá tu selección en tiempo real.</span>
            {account.creatorAliasCbu && (
              <strong className="alias">
                Alias/CBU: {account.creatorAliasCbu}
              </strong>
            )}
          </div>
          <div className="status-card">
            <h2>Progreso de la cuenta</h2>
            <div className="progress-bar">
              <div className="progress" style={{ width: `${percentage}%` }} />
            </div>
            <div className="progress-info">
              <span>
                {money(paidAmount)} de {money(account.totalCents)}
              </span>
              <strong>{percentage}%</strong>
            </div>
          </div>
          {!paid && (
            <button
              className="confirm-button transfer-button"
              onClick={async () => {
                await updateStatus("paid");
                setPaid(true);
              }}
            >
              REGISTRAR PAGO
            </button>
          )}
          {paid && (
            <button className="back-button" onClick={() => window.close()}>
              CERRAR
            </button>
          )}
          {!paid && (
            <button className="back-button" onClick={() => setConfirmed(false)}>
              VOLVER A EDITAR
            </button>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="container">
        <header className="header">
          <div className="logo">
            Te <span>Debo</span>
          </div>
          <div className="account-info">
            <h1>{account.name}</h1>
            <p>
              Creada por {account.creatorName} · Hola, {guestName}
            </p>
          </div>
        </header>
        <div className="total-card">
          <span>Total del ticket</span>
          <strong>{money(account.totalCents)}</strong>
        </div>
        <section className="products-card">
          <div className="section-title">
            <h2>
              {isItemMode
                ? "Seleccioná lo que consumiste"
                : "Tu parte de la cuenta"}
            </h2>
            <p>
              {isItemMode
                ? "Elegí las unidades que te corresponden. Los productos compartidos se reparten entre quienes los seleccionen."
                : account.mode === "equal"
                  ? "Tu parte fue calculada por el creador en partes iguales."
                  : "El creador asignará tu parte manualmente."}
            </p>
          </div>
          {isItemMode ? (
            <div className="products">
              {(account.items || []).map((item) => {
                const selected = Number(participant.selections?.[item.id] || 0);
                return (
                  <div className="product" key={item.id}>
                    <div className="product-info">
                      <h3>{item.name}</h3>
                      <p>
                        {item.quantity > 1
                          ? `${item.quantity} unidades`
                          : "1 unidad"}
                      </p>
                    </div>
                    <div className="product-right">
                      <div className="product-price">
                        {money(item.totalCents)}
                      </div>
                      <div className="counter">
                        <button
                          onClick={() => changeSelection(item, -1)}
                          disabled={!selected}
                        >
                          -
                        </button>
                        <span>{selected}</span>
                        <button
                          onClick={() => changeSelection(item, 1)}
                          disabled={selected >= item.quantity}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="assigned-part">
              <span>
                {assignedPart
                  ? "Monto asignado"
                  : "Monto pendiente de asignación"}
              </span>
              <strong>
                {assignedPart ? money(assignedPart) : "A confirmar"}
              </strong>
            </div>
          )}
        </section>
        <section className="bottom-card">
          <div>
            <span>Tu parte</span>
            <strong>{money(isItemMode ? myPart : assignedPart)}</strong>
          </div>
          <button
            className="confirm-button"
            onClick={async () => {
              await updateStatus("confirmed");
              setConfirmed(true);
            }}
            disabled={isItemMode && !myPart}
          >
            CONFIRMAR
          </button>
        </section>
      </section>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/c/:slug" element={<AccountPage />} />
    </Routes>
  );
}
export default App;
