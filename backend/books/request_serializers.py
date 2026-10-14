from rest_framework import serializers

from config.serializer_fields import MAX_PRICE, StrictIntegerField


class CatalogPriceSerializer(serializers.Serializer):
    min_price = StrictIntegerField(min_value=0, max_value=MAX_PRICE, required=False)
    max_price = StrictIntegerField(min_value=0, max_value=MAX_PRICE, required=False)
