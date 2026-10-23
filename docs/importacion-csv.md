# Importación CSV de Mantenimientos

## Importación masiva de Maestros

Usa **Maestros → Importación masiva CSV** y selecciona varios archivos `.csv` en una sola acción. Descarga desde el modal el paquete de 17 plantillas con encabezados vacíos. No hace falta seleccionar los archivos en orden: el importador procesa primero monedas, empresa, sucursales, categorías y unidades; después los productos y los catálogos que dependen de ellos. La revisión desplegable muestra el resultado de cada archivo. Un archivo con encabezados incompatibles bloquea todo el lote; una fila con errores se omite y aparece identificada. Puedes omitir o actualizar duplicados antes de confirmar. Los productos entran con stock cero y no se generan operaciones comerciales.

En **Mantenimientos** abre Clientes, Proveedores o Productos y selecciona **Importar CSV**. Descarga la plantilla de ese apartado, completa las filas y guarda el archivo como CSV UTF-8. La plantilla contiene únicamente los encabezados para evitar importar ejemplos como registros reales.

| Apartado | Columnas obligatorias | Columnas opcionales |
| --- | --- | --- |
| Clientes | `name`, `taxId` | `id`, `contact`, `phone`, `email`, `address`, `credit`, `active` |
| Proveedores | `name`, `taxId` (RUC de 11 dígitos válido) | Las columnas de Clientes, además de `tradeName`, `category`, `supplierType`, `registeredAt`, `contactRole`, `alternatePhone`, `district`, `province`, `department`, `paymentTerms`, `currency`, `estimatedDeliveryDays`, `suppliedCategories`, `commercialStatus`, `commercialNotes`, `internalNotes` |
| Productos | `name`, `category`, `unit`, `cost`, `price`, `minimum` | `id`, `description`, `sku`, `barcode`, `active`, `registeredAt` |

La categoría de un producto debe existir previamente en Mantenimientos. `stock` y `warehouseId` no son columnas admitidas: el producto se registra con stock cero y el inventario se modifica exclusivamente mediante recepción de compras. En proveedores, `category` describe la actividad del proveedor y `suppliedCategories` admite valores separados con `|`. No modifica las categorías del ERP.

El separador puede ser coma o punto y coma. Encierra los valores que contengan el separador entre comillas dobles y escapa cada comilla interna duplicándola. Fechas: `AAAA-MM-DD`. Valores monetarios: números no negativos, sin símbolo de moneda. Estado: `Activo`, `Inactivo`, `Sí`, `No`, `true` o `false`. Si falta `id`, el sistema genera un código único y estable. Conserva códigos y documentos con ceros iniciales como texto cuando prepares el archivo en una hoja de cálculo.

La vista previa marca errores y duplicados. Puedes omitir duplicados o actualizar los registros existentes; actualizar conserva el ID y el stock. Una fila errónea no se importa. El resumen final indica nuevos, actualizados, omitidos y erróneos. El guardado usa el mismo estado de compras, ventas, cotizaciones e inventario, y se sincroniza con las demás pestañas del mismo navegador y dominio.
