import LegalPage from './LegalPage';

export default function DatenschutzPage() {
  return (
    <LegalPage title="Datenschutzerklärung">
      <p>
        Wir nehmen den Schutz Ihrer personenbezogenen Daten sehr ernst und behandeln diese
        vertraulich gemäß den gesetzlichen Datenschutzvorschriften (DSGVO, BDSG) sowie dieser
        Datenschutzerklärung.
      </p>

      <h2>1. Verantwortlicher (Art. 13 DSGVO)</h2>
      <p>
        <strong>[UNTERNEHMENSNAME] [RECHTSFORM]</strong><br />
        [STRASSE HAUSNUMMER], [PLZ] [ORT]<br />
        E-Mail: <strong>[DATENSCHUTZ-EMAIL]</strong><br />
        Telefon: <strong>[TELEFON]</strong>
      </p>

      <h2>2. Datenschutzbeauftragter</h2>
      <p>
        [FALLS VORHANDEN: Name und Kontakt des Datenschutzbeauftragten gemäß Art. 37 DSGVO.<br />
        FALLS NICHT ERFORDERLICH: Ein Datenschutzbeauftragter ist nach Art. 37 DSGVO für unser
        Unternehmen nicht verpflichtend bestellt.]
      </p>

      <h2>3. Erhobene Daten und Verarbeitungszwecke</h2>
      <p>Wir verarbeiten personenbezogene Daten nur, soweit dies zur Erbringung unserer
        Dienstleistungen erforderlich ist:</p>
      <ul>
        <li><strong>Stammdaten</strong> (Name, Adresse, Kontaktdaten) — Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)</li>
        <li><strong>Zugangsdaten</strong> (E-Mail, gehashtes Passwort) — Vertragserfüllung und berechtigtes Interesse (Art. 6 Abs. 1 lit. b, f DSGVO)</li>
        <li><strong>Arbeitnehmerüberlassungsdaten</strong> (Qualifikationen, Einsatzdaten) — Vertragserfüllung und gesetzliche Pflichten (Art. 6 Abs. 1 lit. b, c DSGVO)</li>
        <li><strong>Lohn- und Gehaltsdaten, Bankverbindung, Steuer-/Sozialversicherungsnummer</strong> — gesetzliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO)</li>
        <li><strong>Protokolldaten</strong> (IP-Adresse, Zugriffszeiten) — berechtigtes Interesse / IT-Sicherheit (Art. 6 Abs. 1 lit. f DSGVO)</li>
      </ul>

      <h2>4. Speicherdauer</h2>
      <p>
        Daten werden gelöscht, sobald der Zweck der Verarbeitung entfällt und keine
        gesetzlichen Aufbewahrungspflichten entgegenstehen. Für Buchhaltungs- und
        Geschäftsunterlagen gilt eine Aufbewahrungspflicht von 10 Jahren (HGB § 257, AO § 147).
        Audit-Logs werden 10 Jahre aufbewahrt (DSGVO Art. 5 Abs. 2, HGB § 257). Benachrichtigungen
        werden nach 90 Tagen automatisch gelöscht.
      </p>

      <h2>5. Weitergabe an Dritte</h2>
      <p>
        Eine Weitergabe Ihrer Daten an Dritte erfolgt nur, soweit dies zur Vertragserfüllung
        notwendig ist (z. B. Weitergabe von Arbeitnehmer-Stammdaten an Kundenunternehmen im Rahmen
        der Arbeitnehmerüberlassung gemäß AÜG), gesetzlich vorgeschrieben ist (z. B. Finanzamt,
        Sozialversicherungsträger) oder Sie ausdrücklich eingewilligt haben.
      </p>

      <h2>6. Ihre Rechte (Art. 15–22 DSGVO)</h2>
      <ul>
        <li>Auskunft über gespeicherte Daten (Art. 15 DSGVO)</li>
        <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
        <li>Löschung / „Recht auf Vergessenwerden" (Art. 17 DSGVO)</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>Widerspruch gegen Verarbeitung (Art. 21 DSGVO)</li>
        <li>Widerruf erteilter Einwilligungen (Art. 7 Abs. 3 DSGVO)</li>
      </ul>
      <p>
        Zur Ausübung Ihrer Rechte wenden Sie sich bitte an: <strong>[DATENSCHUTZ-EMAIL]</strong>
      </p>

      <h2>7. Beschwerderecht bei der Aufsichtsbehörde</h2>
      <p>
        Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren.
        Die zuständige Behörde für [BUNDESLAND] ist: <strong>[ZUSTÄNDIGE LANDESBEHÖRDE]</strong>
      </p>

      <h2>8. Datensicherheit</h2>
      <p>
        Wir setzen technische und organisatorische Maßnahmen ein, um Ihre Daten gegen
        Verlust, Zerstörung, unberechtigten Zugriff, Veränderung oder Verbreitung zu schützen.
        Sensitive Felder (IBAN, Steuer- und Sozialversicherungsnummer) werden AES-256-GCM
        verschlüsselt gespeichert. Passwörter werden ausschließlich als bcrypt-Hash gespeichert.
        Die Datenübertragung erfolgt verschlüsselt via TLS.
      </p>

      <h2>9. Cookies und Sitzungsdaten</h2>
      <p>
        Die Plattform verwendet ausschließlich technisch notwendige Cookies (HttpOnly
        Refresh-Token-Cookie für die Authentifizierung). Es werden keine Tracking- oder
        Marketing-Cookies eingesetzt.
      </p>

      <h2>10. Änderungen dieser Datenschutzerklärung</h2>
      <p>
        Wir behalten uns vor, diese Datenschutzerklärung anzupassen, um sie an geänderte
        Rechtslage oder Änderungen der Plattform anzupassen. Die aktuelle Version ist stets
        unter diesem Link abrufbar.
      </p>

      <p><strong>Stand: [DATUM]</strong></p>
    </LegalPage>
  );
}
