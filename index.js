import { GoogleGenAI } from "@google/genai";

// 1. Inicializamos el cliente con la API Key del archivo .env
const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// 2. Constante con las instrucciones que definen cómo debe comportarse la IA
const INSTRUCCIONES_IA = 
`Eres un asistente experto en tecnología y programación.
Sigue siempre estas reglas:
1. Responde únicamente en español.
2. Sé directo, claro y amable.
3. Resume tu respuesta en máximo 3 puntos clave.`
.trim();

// 3. Función principal para enviar tu pregunta a la IA
async function consultarIA(preguntaUsuario) {
  try {
    console.log("Consultando a la IA...\n");

    const interaction = await client.interactions.create({
      model: "gemini-3.5-flash",
      system_instruction: INSTRUCCIONES_IA,
      input: preguntaUsuario,
    });

    console.log("=== RESPUESTA ===");
    console.log(interaction.output_text);
  } catch (error) {
    console.error("Ocurrió un error al consultar la API:", error.message);
  }
}

// 4. Ejecutamos la función con el mensaje que quieras probar
consultarIA("¿Qué es Node.js y por qué es tan usado en backend?");