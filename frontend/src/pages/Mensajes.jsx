import Conversacion from '../components/Conversacion.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Mensajes() {
  const { user } = useAuth();
  // El hilo del particular es el suyo propio (cliente_user_id = su id)
  return <Conversacion clienteId={user.id} />;
}
