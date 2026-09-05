import { useState } from "react"
import { Routes, Route, useParams } from "react-router-dom"
import "./App.css"

const accounts = {
  "cena-viernes": {
    title: "Cena viernes",
    createdBy: "Juan",
    total: 75350,

    products: [
      {
        id: 1,
        name: "Pizza muzzarella",
        quantity: 1,
        price: 12500,
        selected: 1,
        shared: false,
  
      },
      {
        id: 2,
        name: "Papas fritas",
        quantity: 1,
        price: 8500,
        selected: 2,
        shared: true,
      },
      {
        id: 3,
        name: "Hamburguesa completa",
        quantity: 1,
        price: 15000,
        selected: 1,
        shared: false,
      },
      {
        id: 4,
        name: "Gaseosa",
        quantity: 2,
        price: 5000,
        selected: 2,
        shared: true,
      },
    ],
  },

  "asado-sabado": {
    title: "Asado del sábado",
    createdBy: "Nico",
    total: 62000,

    products: [
      {
        id: 1,
        name: "Carne",
        quantity: 1,
        price: 28000,
        selected: 1,
        shared: false,
      },
      {
        id: 2,
        name: "Papas",
        quantity: 1,
        price: 9000,
        selected: 2,
        shared: true,
      },
      {
        id: 3,
        name: "Gaseosa",
        quantity: 2,
        price: 6000,
        selected: 2,
        shared: true,
      },
    ],
  },
}

function AccountPage() {
  const { slug } = useParams()

  const account = accounts[slug] || accounts["cena-viernes"]

  const [products, setProducts] = useState(
    account.products.map((product) => ({
      ...product,
      selected: 0,
    }))
  )

  const [confirmed, setConfirmed] = useState(false)
  const [paid, setPaid] = useState(false)
  const [closed, setClosed] = useState(false)

  const changeSelection = (id, amount) => {
    setProducts((currentProducts) =>
      currentProducts.map((product) => {
        if (product.id !== id) {
          return product
        }

        const newSelection = Math.max(
          0,
          Math.min(
            product.quantity,
            product.selected + amount
          )
        )

        return {
          ...product,
          selected: newSelection,
        }
      })
    )
  }

  const calculateMyPart = () => {
    return products.reduce((total, product) => {
      if (product.selected === 0) {
        return total
      }

      if (product.shared) {
        return total + product.price / product.selected
      }

      return total + product.price
    }, 0)
  }

  const myPart = calculateMyPart()

  /*
   * Por ahora simulamos cuánto de la cuenta ya fue pagado.
   * Más adelante este valor vendrá del backend/Firebase.
   */
  const initialPaidAmount = 0

  const [paidAmount, setPaidAmount] = useState(initialPaidAmount)

  const progressPercentage = Math.min(
    100,
    Math.round((paidAmount / account.total) * 100)
  )

  const isAccountSettled = paidAmount >= account.total

  const handleTransfer = () => {
    const newPaidAmount = Math.min(
      account.total,
      paidAmount + Math.round(myPart)
    )

    setPaidAmount(newPaidAmount)
    setPaid(true)
  }

  const handleClose = () => {
    setClosed(true)
  }

  if (closed) {
    return (
      <main className="page">
        <section className="container confirmation-page">

          <div className="confirmation-icon">
            👋
          </div>

          <h1>
            ¡Gracias!
          </h1>

          <p className="confirmation-subtitle">
            Ya podés cerrar esta pestaña.
          </p>

        </section>
      </main>
    )
  }

  if (confirmed) {
    if (isAccountSettled) {
      return (
        <main className="page">
          <section className="container confirmation-page">

            <div className="confirmation-icon">
              🎉
            </div>

            <h1>
              ¡Cuenta saldada!
            </h1>

            <p className="confirmation-subtitle">
              Todos ya pagaron su parte.
            </p>

            <strong className="confirmation-total">
              $0
            </strong>

            <div className="thanks-card">
              <p>
                La cuenta de {account.createdBy} ya está completa 🙌
              </p>

              <span>
                Esta cuenta está cerrada.
              </span>
            </div>

            <button
              className="back-button"
              onClick={handleClose}
            >
              CERRAR
            </button>

          </section>
        </main>
      )
    }

    return (
      <main className="page">
        <section className="container confirmation-page">

          <div className="confirmation-icon">
            {paid ? "✅" : "🎉"}
          </div>

          <h1>
            {paid ? "¡Pago registrado!" : "¡Listo!"}
          </h1>

          <p className="confirmation-subtitle">
            Tu parte de la cuenta es
          </p>

          <strong className="confirmation-total">
            ${Math.round(myPart).toLocaleString("es-AR")}
          </strong>

          <div className="thanks-card">
            <p>
              Gracias, {account.createdBy}, por pagar 🙌
            </p>

            <span>
              {paid
                ? "Tu pago fue registrado correctamente."
                : "Tu selección fue registrada correctamente."}
            </span>
          </div>

          <div className="status-card">
            <h2>
              Progreso de la cuenta
            </h2>

            <div className="progress-bar">
              <div
                className="progress"
                style={{
                  width: `${progressPercentage}%`,
                }}
              ></div>
            </div>

            <div className="progress-info">
              <span>
                ${paidAmount.toLocaleString("es-AR")} de{" "}
                ${account.total.toLocaleString("es-AR")}
              </span>

              <strong>
                {progressPercentage}%
              </strong>
            </div>
          </div>

          {!paid && (
            <button
              className="confirm-button transfer-button"
              onClick={handleTransfer}
            >
              💸 TRANSFERIR $
              {Math.round(myPart).toLocaleString("es-AR")}
            </button>
          )}

          {paid && (
            <button
              className="back-button"
              onClick={handleClose}
            >
              CERRAR
            </button>
          )}

          {!paid && (
            <button
              className="back-button"
              onClick={() => setConfirmed(false)}
            >
              VOLVER A EDITAR
            </button>
          )}

        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <section className="container">

        <header className="header">
          <div className="logo">
            Te <span>Debo</span>
          </div>

          <div className="account-info">
            <h1>{account.title}</h1>

            <p>
              Creada por {account.createdBy}
            </p>
          </div>
        </header>

        <div className="total-card">
          <span>
            Total del ticket
          </span>

          <strong>
            ${account.total.toLocaleString("es-AR")}
          </strong>
        </div>

        <section className="products-card">

          <div className="section-title">
            <h2>
              Seleccioná lo que consumiste
            </h2>

            <p>
              Los productos compartidos se dividen entre quienes los
              seleccionen.
            </p>
          </div>

          <div className="products">

            {products.map((product) => (
              <div
                className="product"
                key={product.id}
              >

                <div className="product-icon">
                  {product.icon}
                </div>

                <div className="product-info">
                  <h3>
                    {product.name}
                  </h3>

                  <p>
                    {product.quantity > 1
                      ? `${product.quantity} unidades`
                      : "1 unidad"}
                  </p>

                  {product.shared && (
                    <small>
                      Compartido
                    </small>
                  )}
                </div>

                <div className="product-right">

                  <div className="product-price">
                    ${product.price.toLocaleString("es-AR")}
                  </div>

                  <div className="counter">

                    <button
                      onClick={() =>
                        changeSelection(product.id, -1)
                      }
                    >
                      −
                    </button>

                    <span>
                      {product.selected}
                    </span>

                    <button
                      onClick={() =>
                        changeSelection(product.id, 1)
                      }
                    >
                      +
                    </button>

                  </div>

                </div>

              </div>
            ))}

          </div>
        </section>

        <section className="bottom-card">

          <div>
            <span>
              Tu parte
            </span>

            <strong>
              ${Math.round(myPart).toLocaleString("es-AR")}
            </strong>
          </div>

          <button
            className="confirm-button"
            onClick={() => setConfirmed(true)}
            disabled={myPart === 0}
          >
            CONFIRMAR
          </button>

        </section>

      </section>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<AccountPage />}
      />

      <Route
        path="/c/:slug"
        element={<AccountPage />}
      />
    </Routes>
  )
}

export default App