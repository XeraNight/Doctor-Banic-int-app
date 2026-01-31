
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-transparent p-4">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Späť
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Ochrana osobných údajov</CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-2">1. Úvodné ustanovenia</h2>
              <p>
                Vaše súkromie berieme vážne. Tieto zásady ochrany osobných údajov vysvetľujú, ako zhromažďujeme,
                používame a chránime vaše osobné údaje pri používaní aplikácie Doktor Baník.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">2. Aké údaje zbierame</h2>
              <p>Pri registrácii a používaní aplikácie môžeme spracúvať nasledujúce údaje:</p>
              <ul className="list-disc pl-5">
                <li>Identifikačné údaje (meno, priezvisko, titul)</li>
                <li>Kontaktné údaje (e-mail, telefónne číslo)</li>
                <li>Zdravotné záznamy potrebné pre poskytovanie zdravotnej starostlivosti</li>
                <li>Technické údaje (IP adresa, logy prístupov)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">3. Účel spracúvania</h2>
              <p>Vaše údaje spracúvame na nasledujúce účely:</p>
              <ul className="list-disc pl-5">
                <li>Poskytovanie zdravotnej starostlivosti a vedenie zdravotnej dokumentácie</li>
                <li>Správa používateľského účtu a rezervácií</li>
                <li>Komunikácia s pacientom (notifikácie, pripomienky)</li>
                <li>Zabezpečenie aplikácie a prevencia podvodov</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">4. Právny základ</h2>
              <p>
                Spracúvanie vašich údajov je nevyhnutné na plnenie zmluvy (poskytovanie zdravotnej starostlivosti),
                plnenie zákonných povinností alebo na základe vášho súhlasu.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">5. Vaše práva</h2>
              <p>Podľa GDPR máte právo na:</p>
              <ul className="list-disc pl-5">
                <li>Prístup k vašim údajom</li>
                <li>Opravu nesprávnych údajov</li>
                <li>Vymazanie údajov (právo „byť zabudnutý“), ak to nebráni zákonným povinnostiam</li>
                <li>Obmedzenie spracúvania</li>
                <li>Prenosnosť údajov</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">6. Kontakt</h2>
              <p>
                V prípade otázok týkajúcich sa ochrany osobných údajov nás môžete kontaktovať
                na e-mailovej adrese: info@doktorbanik.sk
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
