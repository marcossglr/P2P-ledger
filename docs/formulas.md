# Guía Operativa de Cálculos y Auditoría Financiera P2P

> **La Regla de Oro del Comerciante P2P**:  
> **"Tus ganancias y tu capital real se miden en USDT. La moneda local (VES) es solo el puente bancario para mover el dinero."**

Cuando operas en arbitraje P2P en países con inflación o devaluación, contar ganancias en Bolívares puede engañarte: podrías terminar el día con más Bolívares en la cuenta bancaria pero con menos dólares en el bolsillo por efecto del aumento de la tasa de cambio. 

Por eso, este sistema está diseñado para que cualquier comerciante pueda **auditar y verificar sus números con total transparencia**, respondiendo con certeza a dos preguntas:
1. **¿Cuántos dólares (USDT) netos y limpios me gané hoy?** (Tu ganancia real).
2. **¿Cuadran los Bolívares que entraron y salieron de mi banco?** (Tu flujo de caja).

---

## 1. ¿Cómo se calculan los Precios, Tasas y Márgenes?

### 1.1 Tasa Promedio de Compra (WAC)
Es el precio medio real que pagaste por cada USDT que compraste durante la jornada o período:

$$\text{Tasa Compra} = \frac{\text{Total de Bolívares Pagados en Compras}}{\text{Total de USDT Recibidos en Compras}}$$

* **En palabras sencillas**: Si hiciste 5 compras a diferentes tasas, no se saca un promedio simple; cada compra pesa según la cantidad de dólares que compraste. Así sabes con exactitud matemática a qué precio compraste tu mercancía.

---

### 1.2 Tasa Promedio de Venta (WAP)
Es el precio medio real al que vendiste cada USDT durante la jornada o período:

$$\text{Tasa Venta} = \frac{\text{Total de Bolívares Recibidos en Ventas}}{\text{Total de USDT Entregados en Ventas}}$$

* **En palabras sencillas**: Refleja el precio promedio al que cobraste tus dólares en el banco.

---

### 1.3 Spread de Mercado (Diferencial de Precios)
Es la distancia comercial directa entre tus precios de venta y compra:

* **Spread en Bolívares**: $\text{Tasa Venta} - \text{Tasa Compra}$  
  *(Ejemplo: si compraste en promedio a 1.003,73 Bs y vendiste a 1.009,47 Bs, te ganaste un diferencial bruto de **+5,74 Bs por cada USDT**).*
* **Spread en Porcentaje**: $\left(\frac{\text{Spread en Bolívares}}{\text{Tasa Compra}}\right) \times 100$  
  *(Siguiendo el ejemplo anterior: representa un margen comercial bruto de **+0,57%**).*

---

### 1.4 Tasa Piso de Equilibrio (Breakeven)
Es el **precio mínimo de venta** al que debes publicar tu anuncio para no perder dinero:

$$\text{Tasa Piso Breakeven} = \text{Tasa Compra} + \frac{\text{Comisiones de Binance} + \text{Comisiones de Bancos}}{\text{USDT Arbitrados}}$$

* **¿Para qué te sirve?**: Te dice cuál es el límite inferior al que puedes vender. Si vendes por debajo de esta tasa, aunque tengas spread positivo en apariencia, las comisiones te harán perder dinero. Si vendes por encima de esta tasa, cada centavo adicional es ganancia neta en tu bolsillo.

---

### 1.5 Margen Neto Real Post-Comisiones
Mide la rentabilidad real y limpia que te rinde cada dólar que rotaste en el mercado después de pagarle a Binance y a los bancos:

$$\text{Margen Neto (\%)} = \left(\frac{\text{Ganancia Neta (USDT)}}{\text{Volumen Arbitrado (USDT)}}\right) \times 100$$

---

## 2. ¿Cómo se calcula la Ganancia Neta Real (P&L)?

### 2.1 El Principio de Ciclo Cerrado (Volumen Arbitrado)
Una regla básica del comercio es: **solo hay ganancia cuando completas el ciclo (compras y vendes)**. 

Si compraste 1.500 USDT pero solo vendiste 1.000 USDT:
* Has completado el arbitraje sobre **1.000 USDT**. Sobre esos 1.000 USDT se calcula tu ganancia realizada del día.
* Los 500 USDT restantes no son ganancia ni pérdida: son **mercancía en stock** que tienes guardada en tu billetera para vender mañana.

$$\text{Volumen Arbitrado (Matched USDT)} = \text{El menor entre (Total Comprado, Total Vendido)}$$

---

### 2.2 Desbalance de Inventario (Flujo de Stock)
Te indica si al final de la jornada quedaste con más dólares o si liquidaste inventario anterior:

$$\text{Flujo Neto de Inventario} = \text{USDT Comprados} - \text{USDT Vendidos}$$

* **Si es positivo (+X USDT acum.)**: Compraste más de lo que vendiste; acumulaste dólares en tu billetera.
* **Si es negativo (-X USDT liq.)**: Vendiste más de lo que compraste hoy; liquidaste inventario que traías de días anteriores.

---

### 2.3 Ganancia Bruta
Es el beneficio generado por la rotación del volumen arbitrado antes de restar comisiones:

$$\text{Ganancia Bruta (VES)} = \text{Volumen Arbitrado (USDT)} \times \text{Spread en Bolívares}$$

---

### 2.4 Deducción Transparente de Comisiones

El sistema no oculta ni infla números; audita y descuenta el 100% de los costos operativos:

1. **Comisiones de Binance P2P (Maker y Taker)**:
   * Binance te descuenta comisiones en USDT directamente en tu billetera de Fondos al ejecutarse tus órdenes.
   * El sistema suma todas las comisiones en USDT cobradas por Binance (tanto en compras como en ventas) y calcula su costo exacto de reposición en Bolívares usando tu tasa de compra.
2. **Comisiones Bancarias (Pago Móvil)**:
   * En Venezuela, las transferencias entre cuentas del mismo banco tienen 0% de comisión. 
   * Las compras que realizas vía Pago Móvil sí generan una comisión bancaria (generalmente 0.3%). El sistema aplica este porcentaje únicamente sobre las compras realizadas por Pago Móvil.

---

### 2.5 Ganancia Neta Limpia (Lo que te queda en el bolsillo)

Primero se calcula la ganancia neta en Bolívares restando los costos operativos:

$$\text{Ganancia Neta (VES)} = \text{Ganancia Bruta} - \text{Comisiones Binance (VES)} - \text{Comisiones Bancarias (VES)}$$

Y finalmente se convierte a la **unidad real de riqueza (USDT)** dividiendo entre tu tasa de compra:

$$\text{Ganancia Neta (USDT)} = \frac{\text{Ganancia Neta (VES)}}{\text{Tasa Compra (WAC)}}$$

* **Tu resultado real**: Esta cifra te muestra con total certeza cuántos dólares netos y limpios le sumaste a tu patrimonio al terminar tus operaciones.

---

## 3. Resumen Rápido de las Tarjetas de la Aplicación

| Tarjeta | ¿Qué te muestra? | ¿Cómo revisarla o auditarla? |
| :--- | :--- | :--- |
| **1. Ganancia Neta (P&L)** | Tu beneficio limpio en **USDT** y su equivalente aproximado en Bolívares. | Es el resultado final tras restar todas las comisiones de Binance y bancos. |
| **2. Spread Promedio** | El margen porcentual y en Bolívares entre tus compras y ventas. | Te muestra tu Tasa Compra (WAC), Tasa Venta (WAP) y la Tasa Piso Breakeven. |
| **3. Volumen Cripto** | Los USDT que rotaron en ciclo completo (*ciclados*). | En la línea inferior te muestra compras, ventas y si acumulaste o liquidaste stock. |
| **4. Flujo de Caja (VES)** | El movimiento total de dinero en Bolívares en tus cuentas bancarias. | Te desglosa las salidas de dinero (compras) vs las entradas de dinero (ventas). |
| **5. Comisiones Totales** | El total de gastos operativos en USDT y Bolívares. | Desglosa exactamente cuánto se quedó Binance P2P y cuánto se llevaron los bancos. |

---

## 4. Auditoría Diaria y Registro de Operaciones

* **Desglose Diario**: Si consultas un período de varios días (por ejemplo, los últimos 7 días o el mes), cada fila de la tabla diaria aplica exactamente estas mismas fórmulas para decirte cuánto ganaste día por día.
* **Libro de Órdenes P2P**: Puedes hacer clic en cualquier orden individual para abrir su detalle, cotejar los montos tal cual aparecen en Binance P2P y verificar la tasa efectiva limpia de esa operación.
