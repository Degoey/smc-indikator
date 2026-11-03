export class OBZonePrimitive {
  constructor(zones) {
    this.zones = zones || []
    this.chart = null
    this.series = null
    this.requestUpdate = null
    this._paneViews = [
      {
        renderer: () => this,
      },
    ]
  }

  setZones(zones) {
    this.zones = zones || []
    if (this.requestUpdate) this.requestUpdate()
  }

  updateAllViews() {}

  paneViews() {
    return this._paneViews
  }

  attached(param) {
    this.chart = param.chart
    this.series = param.series
    this.requestUpdate = param.requestUpdate
  }

  detached() {
    this.chart = null
    this.series = null
    this.requestUpdate = null
  }

  drawBackground(target) {
    target.useBitmapCoordinateSpace((context) => {
      if (!this.series || !this.chart) return

      const ctx = context.context
      const horizontalPixelRatio = context.horizontalPixelRatio
      const verticalPixelRatio = context.verticalPixelRatio
      const bitmapWidth = context.bitmapSize.width
      const bitmapHeight = context.bitmapSize.height

      const chartTimeScale = this.chart.timeScale()
      const visibleRange = chartTimeScale.getVisibleRange()
      if (!visibleRange) return

      const endTime = this.zones[0]?.endTime ?? visibleRange.to

      for (const zone of this.zones) {
        const topY = this.series.priceToCoordinate(zone.topPrice)
        const bottomY = this.series.priceToCoordinate(zone.bottomPrice)
        const startX = chartTimeScale.timeToCoordinate(zone.startTime)
        let endX = chartTimeScale.timeToCoordinate(endTime)

        if (topY === null || bottomY === null || startX === null) continue
        if (endX === null) {
          endX = bitmapWidth
        }

        const x = Math.min(startX, endX) * horizontalPixelRatio
        const y = Math.min(topY, bottomY) * verticalPixelRatio
        const width = Math.abs(endX - startX) * horizontalPixelRatio
        const height = Math.abs(topY - bottomY) * verticalPixelRatio

        if (x + width < 0 || x > bitmapWidth || y + height < 0 || y > bitmapHeight) continue

        ctx.fillStyle = zone.fillColor
        ctx.fillRect(x, y, width, height)

        ctx.strokeStyle = zone.borderColor
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, width, height)

        if (zone.label) {
          ctx.font = `${Math.round(10 * verticalPixelRatio)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
          ctx.fillStyle = zone.borderColor
          ctx.textAlign = "left"
          ctx.textBaseline = "top"
          ctx.fillText(zone.label, x + 4 * horizontalPixelRatio, y + 4 * verticalPixelRatio)
        }
      }
    })
  }

  draw() {}
}
