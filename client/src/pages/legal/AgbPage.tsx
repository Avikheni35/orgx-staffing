import LegalPage from './LegalPage';

export default function AgbPage() {
  return (
    <LegalPage title="Allgemeine Geschäftsbedingungen (AGB)">
      <p>
        Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der
        OrgX-Plattform zwischen <strong>[UNTERNEHMENSNAME] [RECHTSFORM]</strong> (nachfolgend
        „Anbieter") und dem Unternehmen, das die Plattform nutzt (nachfolgend „Kunde").
        Es handelt sich um ein ausschließlich an Unternehmen (B2B) gerichtetes Angebot.
      </p>

      <h2>§ 1 Vertragsgegenstand</h2>
      <p>
        Der Anbieter stellt dem Kunden eine cloudbasierte Software-as-a-Service (SaaS)-Plattform
        zur Verwaltung von Zeitarbeitsprozessen (Modul M1), Veranstaltungspersonaleinsatz (Modul M2)
        und betrieblichem Rechnungswesen / ERP (Modul M3) zur Verfügung. Der genaue Leistungsumfang
        ergibt sich aus der zum Zeitpunkt des Vertragsschlusses gültigen Leistungsbeschreibung.
      </p>

      <h2>§ 2 Vertragsschluss</h2>
      <p>
        Der Vertrag kommt durch schriftliche Auftragsbestätigung des Anbieters oder durch
        Freischaltung des Kundenaccounts zustande. Allgemeine Geschäftsbedingungen des Kunden
        werden nicht Vertragsbestandteil, auch wenn der Anbieter ihnen nicht ausdrücklich
        widerspricht.
      </p>

      <h2>§ 3 Leistungsumfang und Verfügbarkeit</h2>
      <p>
        Der Anbieter bemüht sich um eine Verfügbarkeit der Plattform von 99 % im
        Jahresdurchschnitt (außerhalb angekündigter Wartungsfenster). Eine Garantie der
        ununterbrochenen Verfügbarkeit wird nicht übernommen. Geplante Wartungsarbeiten
        werden mit angemessener Vorankündigung bekanntgegeben.
      </p>

      <h2>§ 4 Nutzungsrechte</h2>
      <p>
        Der Anbieter räumt dem Kunden ein nicht übertragbares, nicht exklusives Recht ein,
        die Plattform für eigene betriebliche Zwecke zu nutzen. Eine Weitergabe von
        Zugangsdaten an Dritte außerhalb der Organisation des Kunden ist untersagt.
      </p>

      <h2>§ 5 Pflichten des Kunden</h2>
      <ul>
        <li>Zugangsdaten sicher aufzubewahren und vor unbefugtem Zugriff zu schützen</li>
        <li>Die Plattform nicht missbräuchlich zu nutzen (z. B. DoS-Angriffe, Reverse Engineering)</li>
        <li>Richtige und vollständige Angaben zu Unternehmen und Nutzern zu machen</li>
        <li>Geltende Datenschutzvorschriften einzuhalten, insbesondere bei der Verarbeitung von Arbeitnehmerdaten</li>
        <li>Änderungen an Unternehmensdaten zeitnah mitzuteilen</li>
      </ul>

      <h2>§ 6 Vergütung und Zahlungsbedingungen</h2>
      <p>
        Die Vergütung richtet sich nach dem zum Zeitpunkt des Vertragsschlusses gültigen
        Preisblatt. Rechnungen sind innerhalb von 14 Tagen nach Rechnungsstellung ohne Abzug
        zu begleichen. Bei Zahlungsverzug ist der Anbieter berechtigt, den Zugang zur Plattform
        zu sperren. Preisanpassungen werden dem Kunden mindestens 6 Wochen vor Inkrafttreten
        schriftlich mitgeteilt.
      </p>

      <h2>§ 7 Datenschutz und Datensicherheit</h2>
      <p>
        Soweit der Anbieter im Auftrag des Kunden personenbezogene Daten verarbeitet, schließen
        die Parteien einen Auftragsverarbeitungsvertrag (AVV) gemäß Art. 28 DSGVO ab. Der
        Anbieter ergreift technische und organisatorische Maßnahmen (TOM) zur Sicherung der Daten.
        Näheres regelt die Datenschutzerklärung und der AVV.
      </p>

      <h2>§ 8 Vertraulichkeit</h2>
      <p>
        Beide Parteien verpflichten sich, vertrauliche Informationen der anderen Partei nicht
        an Dritte weiterzugeben und nur für Zwecke des Vertrags zu verwenden. Diese Pflicht
        gilt über das Ende des Vertragsverhältnisses hinaus für einen Zeitraum von 3 Jahren.
      </p>

      <h2>§ 9 Haftung</h2>
      <p>
        Der Anbieter haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des
        Körpers oder der Gesundheit sowie bei Vorsatz und grober Fahrlässigkeit. Bei leichter
        Fahrlässigkeit haftet der Anbieter nur, wenn eine wesentliche Vertragspflicht
        (Kardinalpflicht) verletzt wurde, und zwar begrenzt auf den vertragstypisch vorhersehbaren
        Schaden. Eine weitergehende Haftung ist ausgeschlossen. Der Anbieter haftet nicht für
        Datenverluste, die auf fehlerhafte Dateneingabe durch den Kunden zurückzuführen sind.
      </p>

      <h2>§ 10 Laufzeit und Kündigung</h2>
      <p>
        Der Vertrag wird auf unbestimmte Zeit geschlossen und kann von beiden Parteien mit
        einer Frist von [X Wochen/Monaten] zum Monatsende ordentlich gekündigt werden. Das
        Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Nach
        Vertragsende werden alle Kundendaten innerhalb von [30 Tagen] gelöscht, sofern keine
        gesetzlichen Aufbewahrungspflichten entgegenstehen.
      </p>

      <h2>§ 11 Änderungen der AGB</h2>
      <p>
        Der Anbieter behält sich vor, diese AGB mit einer Ankündigungsfrist von mindestens
        6 Wochen zu ändern. Widerspricht der Kunde der Änderung nicht innerhalb dieser Frist,
        gelten die neuen AGB als vereinbart. Auf das Widerspruchsrecht wird gesondert hingewiesen.
      </p>

      <h2>§ 12 Schlussbestimmungen</h2>
      <p>
        Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Ausschließlicher
        Gerichtsstand für alle Streitigkeiten aus oder im Zusammenhang mit diesem Vertrag ist
        — soweit gesetzlich zulässig — <strong>[GERICHTSSTAND]</strong>. Sollten einzelne
        Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
      </p>

      <p><strong>Stand: [DATUM]</strong></p>
    </LegalPage>
  );
}
