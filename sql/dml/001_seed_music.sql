INSERT OR IGNORE INTO knowledge_documents (slug, title, category, content, tags) VALUES
(
  'circulo-de-quintas',
  'Círculo de quintas y armaduras',
  'Teoría Musical',
  'El círculo de quintas organiza las doce tonalidades cromáticas por intervalos de quinta justa ascendente en sentido horario (Do, Sol, Re, La, Mi, Si...) agregando un sostenido a la armadura en cada paso. En sentido antihorario avanza por cuartas justas (Fa, Sib, Mib, Lab...) añadiendo bemoles. Cada tonalidad mayor comparte exactamente la misma armadura con su relativa menor situada una tercera menor por debajo, por ejemplo Do mayor y La menor.',
  'teoria,tonalidad,armaduras,quintas,relativa-menor'
),
(
  'modos-griegos',
  'Modos griegos y notas características',
  'Teoría Musical',
  'Los siete modos diatónicos se obtienen al tomar cada grado de la escala mayor como centro tonal: jónico, dórico, frigio, lidio, mixolidio, eólico y locrio. El modo dórico destaca por su sexta mayor sobre una tríada menor, muy usada en jazz y funk, mientras que el lidio se caracteriza por su cuarta aumentada (#11) que aporta luminosidad. El modo frigio introduce una segunda menor (b2) de carácter español o flamenco y el mixolidio incorpora una séptima menor (b7) esencial en el blues y el rock.',
  'modos,escalas,dorico,lidio,frigio,mixolidio'
),
(
  'acordes-septima-tensiones',
  'Acordes de séptima y tensiones armónicas',
  'Armonía',
  'Un acorde de séptima añade una tercera adicional sobre la tríada básica, generando especies fundamentales como maj7 (mayor con séptima mayor), m7 (menor con séptima menor), 7 (dominante con tritono entre 3ª mayor y 7ª menor) y m7b5 (semidisminuido). Sobre estos pilares se superponen tensiones disponibles —novena, oncena y trecena— que corresponden a la segunda, cuarta y sexta una octava arriba. Para evitar choques de novena menor con las notas guía, en acordes mayores se prefiere la oncena aumentada (#11) y en dominantes alterados aparecen b9, #9 y b13.',
  'armonia,acordes,septima,tensiones,tritono,jazz'
),
(
  'sintesis-sustractiva-vs-fm',
  'Síntesis sustractiva frente a síntesis FM',
  'Producción y Audio',
  'La síntesis sustractiva parte de formas de onda ricas en armónicos —como diente de sierra o cuadrada— generadas por osciladores y las esculpe mediante filtros paso bajo, paso alto o paso banda controlados por envolventes ADSR y LFO. En cambio, la síntesis por modulación de frecuencia (FM) modula la frecuencia de una onda portadora con una o más ondas moduladoras a velocidades de audio, creando bandas laterales armónicas o inarmónicas. Mientras la sustractiva brilla en bajos cálidos y pads analógicos, la FM destaca en campanas metálicas, pianos eléctricos percusivos y texturas digitales complejas.',
  'sintesis,sustractiva,fm,oscilador,filtro,adsr'
),
(
  'ecualizacion-rango-frecuencias',
  'Ecualización y mapa de rangos de frecuencia',
  'Producción y Audio',
  'El espectro audible humano abarca aproximadamente de 20 Hz a 20 kHz y suele dividirse en subgraves (20-60 Hz), graves (60-250 Hz), medios-graves (250-500 Hz), medios (500 Hz-2 kHz), medios-agudos o presencia (2-6 kHz) y brillo o aire (6-20 kHz). Aplicar un filtro paso alto entre 80 y 120 Hz en guitarras, voces y teclados limpia energía innecesaria y libera espacio para el bombo y el bajo. Atenuar selectivamente entre 250 y 400 Hz reduce el sonido encajonado, mientras que realces suaves alrededor de 3 a 5 kHz mejoran la inteligibilidad vocal sin generar fatiga auditiva.',
  'ecualizacion,eq,frecuencias,mezcla,filtro-paso-alto'
),
(
  'compresion-dinamica-sidechain',
  'Compresión dinámica y técnica sidechain',
  'Producción y Audio',
  'Un compresor reduce el rango dinámico atenuando la señal que supera un umbral (threshold) según una proporción (ratio), con tiempos de ataque y liberación (attack/release) que moldean la transitoria y el sustain. Un ataque lento deja pasar el golpe inicial de una caja o bombo antes de comprimir, mientras que un ataque rápido controla picos agresivos. En la compresión sidechain, la ganancia de una pista —habitualmente el bajo o un pad— se atenúa usando como señal detectora otra fuente externa como el bombo, evitando solapamientos en graves y creando bombeo rítmico.',
  'compresion,dinamica,sidechain,threshold,attack,release'
),
(
  'polirritmia-y-sincopa',
  'Polirritmia y síncopa en el lenguaje rítmico',
  'Teoría Musical',
  'La síncopa consiste en desplazar el acento rítmico hacia partes débiles del compás o fracciones intermedias, prolongando notas sobre el pulso fuerte siguiente para generar impulso y sorpresa. La polirritmia, en cambio, superpone simultáneamente dos o más divisiones rítmicas independientes dentro del mismo lapso temporal, como un tresillo contra dos corcheas (3:2) o cuatro contra tres (4:3). Ambos recursos son pilares de la música afrocaribeña, el jazz contemporáneo, el metal progresivo y la electrónica experimental.',
  'ritmo,polirritmia,sincopa,compas,groove'
),
(
  'blues-12-compases-legado',
  'El Blues de 12 compases y su legado armónico',
  'Historia Musical',
  'Nacido en el sur de Estados Unidos a finales del siglo XIX a partir de cantos de trabajo, espirituales y tradiciones afroamericanas, el blues consolidó una estructura formal de doce compases dividida en tres frases AAB de cuatro compases cada una. Su progresión armónica clásica utiliza acordes dominantes sobre los grados I7, IV7 y V7, combinados con notas blue (tercera menor, quinta disminuida y séptima menor) frente a la armonía mayor. Esta forma y su lenguaje expresivo originaron directamente el rhythm and blues, el jazz moderno, el rock and roll y gran parte de la música popular occidental.',
  'historia,blues,12-compases,progresion,blue-notes'
),
(
  'contrabajo-vs-bajo-electrico',
  'Contrabajo frente a bajo eléctrico en el groove',
  'Instrumentación',
  'El contrabajo acústico posee una caja de resonancia de madera, escala larga cercana a 41-42 pulgadas y diapasón sin trastes, produciendo un ataque cálido con rápido decaimiento natural y rico contenido en medios-graves al tocarse con pizzicato o arco. El bajo eléctrico de cuerpo sólido, popularizado por Leo Fender en 1951 con el Precision Bass, utiliza pastillas magnéticas y trastes metálicos que brindan mayor afinación precisa, sustain prolongado y definición en el registro grave. En géneros como el jazz acústico y el bluegrass predomina el contrabajo, mientras que el funk, el rock y el pop moderno aprovechan la articulación del bajo eléctrico.',
  'instrumentacion,contrabajo,bajo-electrico,groove,pizzicato'
),
(
  'microfonia-estereo-acustica-sala',
  'Microfonía estéreo y acústica de sala',
  'Producción y Audio',
  'Las técnicas de microfonía estéreo capturan el ancho espacial y la reverberación natural de un recinto mediante pares coincidentes como XY (dos cardioides a 90° sin diferencia de tiempo) o pares espaciados como AB (dos omnidireccionales separados que generan imagen amplia por diferencia de fase y tiempo). La técnica ORTF combina dos cardioides separados 17 cm con un ángulo de 110°, emulando la distancia entre los oídos humanos con gran realismo. Para evitar problemas de filtrado en peine al sumar a mono, conviene respetar la regla 3:1 manteniendo entre micrófonos al menos el triple de la distancia respecto a la fuente sonora.',
  'microfonia,estereo,xy,ortf,acustica,fase'
);
