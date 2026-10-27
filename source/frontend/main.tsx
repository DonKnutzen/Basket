import React from 'react';
import {createRoot} from 'react-dom/client';
import BasketApp from '../app/basket-app';
import AccountComplete from '../app/account-complete/page';
import {appPath} from '../lib/hosting';
import {initializeTextSize} from '../app/text-size-settings';
initializeTextSize();
const complete=window.location.pathname.endsWith('/account-complete.html');
createRoot(document.getElementById('root')!).render(complete?<AccountComplete/>:<BasketApp/>);
if('serviceWorker' in navigator){navigator.serviceWorker.register(appPath('sw.js'),{scope:appPath()}).catch(()=>{});}
