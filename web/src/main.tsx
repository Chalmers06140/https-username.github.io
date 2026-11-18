import React from 'react';
import {createRoot} from 'react-dom/client';
import Game from './game';
import Teacher from './teacher';
import './globals.css';
const route=location.pathname.replace(/\/index\.html$/,'').replace(/\/$/,'');
const page=route.endsWith('/teacher/test')?<Game testMode/>:route.endsWith('/teacher')?<Teacher/>:route.endsWith('/emergency')?<Game emergencyMode/>:<Game/>;
createRoot(document.getElementById('root')!).render(<React.StrictMode>{page}</React.StrictMode>);
