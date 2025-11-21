import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function ImpressumPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gray-50 dark:bg-gray-900 p-4 pt-10">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">
          Impressum
        </h1>
        
        <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
          <p className="font-semibold">Angaben gemäß § 5 TMG</p>
          <p>
            Justcom GmbH<br />
            Süderstr. 75<br />
            20097 Hamburg
          </p>

          <img src="https://static.databutton.com/public/12488b2a-5495-49b3-9146-07e8a9e033b2/logo_justcom_claim_v21-300x76.png" alt="Justcom Logo" className="my-4 h-12 w-auto" />

          <p className="font-semibold mt-4">Geschäftsführer:</p>
          <p>Solaimahn Amiri</p>

          <p className="font-semibold mt-4">Kontakt</p>
          <p>
            Telefon: +49 40 209336440<br />
            Telefax: +49 40 209336449<br />
            E-Mail: anfrage@justcom.de
          </p>

          <p className="font-semibold mt-4">Registereintrag</p>
          <p>
            Eintragung im Handelsregister<br />
            Registergericht: Amtsgericht Hamburg<br />
            Registernummer: HRB 142867
          </p>

          <p className="font-semibold mt-4">Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:</p>
          <p>DE264544383</p>

          <p className="font-semibold mt-4">WEEE-Reg.-Nr.</p>
          <p>DE 95972503</p>

          <p className="font-semibold mt-4">EPR-Registrierungsnummer.</p>
          <p>DE2998839678015</p>

          <p className="font-semibold mt-4">Angaben zur Berufshaftpflichtversicherung</p>
          <p>
            Name und Sitz der Gesellschaft<br />
            SIGNAL IDUNA Gruppe<br />
            Neue Rabenstraße 15-19<br />
            20354 Hamburg<br />
            Telefon: 040 4124-0<br />
            Telefax: 040 4124-2958<br />
            E-Mail: info@signal-iduna.de<br />
            Internet: http://www.signal-iduna.de/
          </p>
          <p className="mt-2">Geltungsraum der Versicherung: Deutschland</p>

          <p className="font-semibold mt-4">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</p>
          <p>Solaimahn Amiri, Süderstr. 75, 20097 Hamburg</p>

          <p className="font-semibold mt-4">Quellenangaben für die verwendeten Bilder und Grafiken</p>
          <p>www.fotolia.de</p>

          <p className="mt-4">Quelle: http://www.e-recht24.de</p>

          <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-800 dark:text-white">Haftungsausschluss (Disclaimer)</h2>
          
          <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-800 dark:text-white">Haftung für Inhalte</h3>
          <p>
            Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
          </p>

          <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-800 dark:text-white">Haftung für Links</h3>
          <p>
            Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.
          </p>

          <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-800 dark:text-white">Urheberrecht</h3>
          <p>
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.
          </p>
        </div>

        <div className="mt-8 text-center">
          <Button 
            onClick={() => navigate(-1)} // Takes user to the previous page
            variant="outline"
            className="border-justcom-blue text-justcom-blue hover:bg-justcom-blue/10"
          >
            Zurück
          </Button>
        </div>
      </div>
    </div>
  );
}
