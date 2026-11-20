import { test, expect } from "../fixtures/browser-test";
const key = "enterprisecloud-integrated-erp-v1";

for (const mobile of [false, true]) {
  test(`premium sales order lifecycle ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/orden-venta");
    const before = await page.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k)!);
      return {
        stock: s.stock,
        movements: s.movements,
        count: s.documents.length,
        customer: s.customers.find((c: { active: boolean }) => c.active),
      };
    }, key);
    await page.getByRole("button", { name: "+ Nueva orden" }).click();
    const order = page.getByRole("dialog", {
      name: "Nueva orden de venta",
      exact: true,
    });
    await expect(
      order.getByText("Registra y administra los pedidos de tus clientes"),
    ).toBeVisible();
    await expect(
      order.getByRole("button", { name: /Nuevo cliente|Registrar cliente/ }),
    ).toHaveCount(0);
    await expect(order.getByLabel("Vigencia (días)")).toHaveCount(0);
    await order
      .getByRole("button", { name: "Seleccionar cliente existente" })
      .click();
    const selector = page.getByRole("dialog", {
      name: "Seleccionar cliente",
      exact: true,
    });
    await selector.getByLabel("Buscar cliente").fill("cliente que no existe");
    await expect(
      selector.getByText("Sin resultados", { exact: true }),
    ).toBeVisible();
    await selector.getByLabel("Buscar cliente").fill(before.customer.taxId);
    await expect(selector.locator(".customer-results > button")).toHaveCount(1);
    await selector.locator(".customer-results > button").click();
    await expect(selector).toBeHidden();
    await order.getByRole("button", { name: "Ver detalles" }).click();
    const details = page.getByRole("dialog", {
      name: "Detalles del cliente",
      exact: true,
    });
    await expect(details).toContainText(before.customer.taxId);
    await page.keyboard.press("Escape");
    await expect(details).toBeHidden();
    await order.locator(".customer-select-trigger").click();
    await selector.getByLabel("Buscar cliente").fill(before.customer.id);
    await expect(
      selector.locator(".customer-results > button"),
    ).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(selector).toBeHidden();
    await expect(order.locator(".customer-select-trigger")).toContainText(
      before.customer.name,
    );
    const bounds = await order.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    await expect(order.locator(".quote-footer")).toBeInViewport();
    await page.screenshot({
      path: `test-results/sales-${mobile ? "mobile" : "desktop"}.png`,
    });
    await order
      .getByRole("button", { name: "Seleccionar productos", exact: true })
      .click();
    const picker = page.getByRole("dialog", {
      name: "Seleccionar productos",
      exact: true,
    });
    await picker.getByLabel("Buscar productos").fill("PRD-001");
    await picker.getByRole("button", { name: "Agregar", exact: true }).click();
    await picker.getByRole("button", { name: "Agregar seleccionados" }).click();
    await expect(picker).toBeHidden();
    await order.getByLabel("Cantidad PRD-001").fill("3");
    await order.getByLabel("Precio PRD-001").fill("100");
    await order.getByLabel("Descuento global").fill("20");
    await order.getByLabel("Flete", { exact: true }).fill("10");
    await order
      .getByLabel("Observaciones", { exact: true })
      .fill("Pedido premium verificado");
    await expect(order.locator(".quote-grand-total strong")).toContainText(
      "290.00",
    );
    await order.getByLabel("Cantidad PRD-001").fill("999999");
    await order.getByRole("button", { name: "Guardar orden" }).click();
    await expect(order.getByRole("alert")).toContainText("Stock insuficiente");
    await order.getByLabel("Cantidad PRD-001").fill("3");
    await order.getByRole("button", { name: /^Eliminar / }).click();
    await expect(order.locator(".quote-empty")).toBeVisible();
    await expect(
      order.getByRole("button", { name: "Guardar orden" }),
    ).toBeDisabled();
    await order
      .getByRole("button", { name: "Seleccionar productos", exact: true })
      .click();
    await picker.getByLabel("Buscar productos").fill("PRD-001");
    await picker.getByRole("button", { name: "Agregar", exact: true }).click();
    await picker.getByRole("button", { name: "Agregar seleccionados" }).click();
    await expect(picker).toBeHidden();
    await order.getByLabel("Cantidad PRD-001").fill("3");
    await order.getByLabel("Precio PRD-001").fill("100");
    await order.getByRole("button", { name: "Guardar orden" }).click();
    await expect(order).toBeHidden();
    await expect(
      page.locator(".sbt-toast").filter({ hasText: "Orden de venta creada correctamente" }),
    ).toBeVisible();
    await page.reload();
    const after = await page.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k)!);
      return {
        stock: s.stock,
        movements: s.movements,
        count: s.documents.length,
        orders: s.documents.filter(
          (d: { notes: string }) => d.notes === "Pedido premium verificado",
        ),
      };
    }, key);
    expect(after.count).toBe(before.count + 1);
    expect(after.orders).toHaveLength(1);
    expect(after.orders[0]).toMatchObject({
      kind: "OV",
      partyId: before.customer.id,
      total: 290,
      status: "Pendiente",
    });
    expect(after.stock).toEqual(before.stock);
    expect(after.movements).toEqual(before.movements);
    expect(errors).toEqual([]);
  });
}

test("sales empty customer catalog directs users to maintenance without creating clients", async ({
  page,
}) => {
  await page.goto("/orden-venta");
  await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k)!);
    s.customers = [];
    localStorage.setItem(k, JSON.stringify(s));
  }, key);
  await page.reload();
  await page.getByRole("button", { name: "+ Nueva orden" }).click();
  await page
    .getByRole("button", { name: "Seleccionar cliente existente" })
    .click();
  const selector = page.getByRole("dialog", {
    name: "Seleccionar cliente",
    exact: true,
  });
  await expect(
    selector.getByText("Aún no hay clientes registrados"),
  ).toBeVisible();
  await expect(
    selector.getByText(
      /Registra tus clientes previamente desde Mantenimientos/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Nuevo cliente|Registrar cliente/ }),
  ).toHaveCount(0);
});
