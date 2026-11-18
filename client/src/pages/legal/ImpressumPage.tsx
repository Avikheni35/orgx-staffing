import LegalPage from './LegalPage';

export default function ImpressumPage() {
  return (
    <LegalPage title="Impressum">
      <p>Angaben gemäß § 5 TMG</p>

      <h2>Anbieter</h2>
      <p>
        <strong>[UNTERNEHMENSNAME] [RECHTSFORM]</strong><br />
        [STRASSE HAUSNUMMER]<br />
        [PLZ] [ORT]<br />
        Deutschland
      </p>

      <h2>Vertreten durch</h2>
      <p>Geschäftsführer: <strong>[VOLLSTÄNDIGER NAME]</strong></p>

      <h2>Kontakt</h2>
      <p>
        Telefon: <strong>[TELEFON]</strong><br />
        E-Mail: <strong>[KONTAKT-EMAIL]</strong>
      </p>

      <h2>Handelsregister</h2>
      <p>
        Registergericht: Amtsgericht <strong>[GERICHTSBEZIRK]</strong><br />
        Registernummer: <strong>[HRB-NUMMER]</strong>
      </p>

      <h2>Umsatzsteuer-Identifikationsnummer</h2>
      <p>
        Gemäß § 27 a Umsatzsteuergesetz:<br />
        <strong>[UST-IDNR, z. B. DE123456789]</strong>
      </p>

      <h2>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
      <p>
        <strong>[VOLLSTÄNDIGER NAME]</strong><br />
        [STRASSE HAUSNUMMER]<br />
        [PLZ] [ORT]
      </p>

      <h2>Streitschlichtung</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
        <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer">
          https://ec.europa.eu/consumers/odr/
        </a>.
      </p>
      <p>
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen, da es sich um ein B2B-Angebot handelt.
      </p>

      <h2>Haftungshinweis</h2>
      <p>
        Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte
        externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber
        verantwortlich.
      </p>
    </LegalPage>
  );
}
