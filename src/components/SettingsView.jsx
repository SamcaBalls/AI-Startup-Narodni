const FIELDS = [
  ["nazev", "Název firmy", "text"],
  ["obecne_zamereni", "Obecné zaměření", "textarea"],
  ["predmet", "Předmět podnikání", "text"],
  ["sidlo", "Sídlo", "text"],
  ["kontaktni_email", "Kontaktní e-mail", "email"],
  ["preferovany_kanal", "Preferovaný kanál", "select"],
  ["prvni_mesic_cinnosti", "První měsíc činnosti", "month"],
  ["predpokladany_obrat_rok", "Odhad ročního obratu", "number"],
  ["plan_zamestnancu", "Plán zaměstnanců", "number"],
  ["provozovna", "Má provozovnu", "checkbox"],
  ["ucetni_kontakt", "Účetní kontakt", "text"],
  ["souhlas_registry", "Souhlas s registry", "checkbox"],
];

const CHANNEL_OPTIONS = ["aplikace", "e-mail", "účetní"];

function Field({ fieldKey, label, type, field, dispatch }) {
  const value = field?.value ?? "";
  const update = (raw) =>
    dispatch({ type: "UPDATE_PROFILE_FIELD", key: fieldKey, value: raw });

  let input;
  if (type === "textarea") {
    input = <textarea value={value} onChange={(event) => update(event.target.value)} />;
  } else if (type === "select") {
    input = (
      <select value={value} onChange={(event) => update(event.target.value)}>
        {CHANNEL_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  } else if (type === "checkbox") {
    input = (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(event) => update(event.target.checked)}
      />
    );
  } else {
    input = (
      <input
        type={type}
        value={value}
        onChange={(event) =>
          update(type === "number" ? Number(event.target.value) : event.target.value)
        }
      />
    );
  }

  return (
    <label className="field">
      <span className="field-label">
        <strong>{label}</strong>
        <small>{field?.required ? "povinné pro demo" : "volitelné"}</small>
      </span>
      {input}
      <span className="field-source">{field?.source ?? "uzivatel"}</span>
    </label>
  );
}

export default function SettingsView({ profile, dispatch }) {
  return (
    <section className="settings">
      {FIELDS.map(([key, label, type]) => (
        <Field
          key={key}
          fieldKey={key}
          label={label}
          type={type}
          field={profile[key]}
          dispatch={dispatch}
        />
      ))}
    </section>
  );
}
