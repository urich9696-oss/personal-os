import { state } from "../state.js";
import { escapeHTML } from "../utils/format.js";
import { modal, closeModal, field, formValues, toast } from "./ui.js";

export function startOnboarding() {
  let step = 0;
  const values = { ...state.settings.profile };
  const screens = [
    { title:"Willkommen bei PersonalOS", body:`<div class="onboarding-hero"><img src="./assets/icons/icon.svg" alt="" width="72"><h3>Ein ruhiger Ort für deinen Alltag.</h3><p>Aufgaben, Kalender, Ziele, Routinen und Finanzen – privat auf deinem Gerät.</p></div>` },
    { title:"Wie dürfen wir dich nennen?", body:field({label:"Name (optional)",name:"name",value:values.name,placeholder:"Dein Name"}) },
    { title:"Deine Standards", body:`<div class="two-col">${field({label:"Währung",name:"currency",type:"select",value:values.currency,options:["EUR","USD","CHF","GBP"].map(x=>[x,x])})}${field({label:"Wochenstart",name:"weekStart",type:"select",value:values.weekStart,options:[["monday","Montag"],["sunday","Sonntag"]]})}</div>` },
    { title:"Fast geschafft", body:field({label:"Zeitformat",name:"timeFormat",type:"select",value:values.timeFormat,options:[["24","24 Stunden"],["12","12 Stunden"]]}) }
  ];
  const draw = () => {
    const screen = screens[step];
    modal({
      title: screen.title,
      content:`<form class="onboarding">${screen.body}<div class="steps" aria-label="Schritt ${step+1} von 4">${screens.map((_,i)=>`<i class="${i===step?"active":""}"></i>`).join("")}</div><footer><button type="button" class="text-button" data-skip>Überspringen</button><button class="button primary">${step===3?"PersonalOS starten":"Weiter"}</button></footer></form>`,
      onOpen:sheet=>{
        sheet.querySelector("[data-skip]").onclick=finish;
        sheet.querySelector("form").onsubmit=e=>{e.preventDefault();Object.assign(values,formValues(e.target));if(step<3){step++;draw();}else finish();};
      }
    });
  };
  const finish = async()=>{await state.save({profile:{...state.settings.profile,...values},onboardingComplete:true});closeModal();toast("Willkommen bei PersonalOS");};
  draw();
}
