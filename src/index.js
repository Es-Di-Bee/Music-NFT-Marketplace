import { render } from "react-dom";
import 'bootstrap/dist/css/bootstrap.css'
import App from './frontend/components/App.js';
import * as serviceWorker from './serviceWorker';

// rendering the html code(contained in App.js) in the html element "root"
// root is in index.html file, and it is like a container for content managed by React
render(<App />, document.getElementById("root"));

serviceWorker.unregister();
